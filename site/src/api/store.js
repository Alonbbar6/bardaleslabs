// Digital store: products in D1, files in R2, payments through Stripe Checkout.
// Secrets: STRIPE_SECRET_KEY (checkout), STRIPE_WEBHOOK_SECRET (signed webhook). RESEND_API_KEY emails receipts.
import { json, text, readJson, rid, token, safeEqual, noTable, MIGRATE } from "./util.js";
import { sendEmail } from "./email.js";
import { deleteImages, PHOTO_ID, FILE_KEY } from "./media.js";
import { DOWNLOAD_LIMIT, priceLabel } from "../render/store.mjs";
import { esc } from "../render/layout.mjs";

export const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{1,59}$/;
const RESERVED = new Set(["thanks", "download", "checkout"]);
const SOURCE = "bardaleslabs-store"; // stamped on our Checkout Sessions; anything else (e.g. old Payment Links) is ignored
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const SESSION = /^cs_[A-Za-z0-9_]{10,250}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const stripeReady = (env) => !!env.STRIPE_SECRET_KEY;

export const listProducts = async (env) => (await env.DB.prepare("SELECT * FROM store_products WHERE status = 'live' ORDER BY sort, created_at DESC").all()).results;
export const getProduct = (env, id) => env.DB.prepare("SELECT * FROM store_products WHERE id = ?").bind(id).first();
const orderBy = (env, col, v) => env.DB.prepare(`SELECT * FROM store_orders WHERE ${col} = ?`).bind(v).first();

async function stripe(env, method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  // STRIPE_API_BASE only exists so tests can point at stripe-mock; leave it unset in production.
  const r = await fetch(`${env.STRIPE_API_BASE || "https://api.stripe.com"}/v1${path}`, {
    method, body, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Stripe ${r.status}`);
  return j;
}

// ---------- checkout: POST /api/store/checkout (plain form post, works without JS)
export async function checkout(request, env) {
  const origin = new URL(request.url).origin;
  const form = await request.formData().catch(() => null);
  const id = String(form?.get("product") || "");
  if (!form || form.get("website")) return Response.redirect(`${origin}/store/`, 303); // honeypot
  const p = PRODUCT_ID.test(id) ? await getProduct(env, id).catch(() => null) : null;
  if (!p || p.status !== "live") return Response.redirect(`${origin}/store/`, 303);
  const back = (why) => Response.redirect(`${origin}/store/${p.id}/?checkout=${why}#buy`, 303);
  if (!p.file_key) return back("error");

  if (!p.price) { // free: trade the download for an email address
    const email = String(form.get("email") || "").trim().slice(0, 200);
    if (!EMAIL.test(email)) return back("email");
    const o = { id: `free_${rid(16)}`, product_id: p.id, email, amount: 0, currency: "usd", token: token(), payment_intent: "" };
    await insertOrder(env, o);
    await deliver(env, o.id, origin);
    return Response.redirect(`${origin}/store/thanks/?order=${o.token}`, 303);
  }
  if (!stripeReady(env)) return back("unavailable");
  try {
    const s = await stripe(env, "POST", "/checkout/sessions", {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(p.price),
      "line_items[0][price_data][product_data][name]": p.name,
      ...(p.short ? { "line_items[0][price_data][product_data][description]": p.short.slice(0, 500) } : {}),
      ...(p.cover && origin.startsWith("https:") ? { "line_items[0][price_data][product_data][images][0]": `${origin}/media/products/${p.cover}.jpg` } : {}),
      success_url: `${origin}/store/thanks/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store/${p.id}/`,
      "metadata[source]": SOURCE,
      "metadata[product_id]": p.id,
      "payment_intent_data[metadata][product_id]": p.id,
      allow_promotion_codes: "true",
    });
    return Response.redirect(s.url, 303);
  } catch (e) {
    console.error("stripe checkout", e);
    return back("error");
  }
}

const insertOrder = (env, o) => env.DB.prepare("INSERT INTO store_orders (id, product_id, email, amount, currency, status, token, payment_intent, created_at) VALUES (?,?,?,?,?,'paid',?,?,?) ON CONFLICT(id) DO NOTHING")
  .bind(o.id, o.product_id, o.email, o.amount, o.currency, o.token, o.payment_intent, Date.now()).run();

/** Idempotent: safe to call from both the webhook and the thanks page. Returns the order, or null if the session isn't ours/paid. */
async function fulfill(env, s, origin) {
  if (!s || s.object !== "checkout.session" || s.metadata?.source !== SOURCE || !["paid", "no_payment_required"].includes(s.payment_status)) return null;
  await insertOrder(env, {
    id: s.id, product_id: String(s.metadata.product_id || ""), email: s.customer_details?.email || s.customer_email || "",
    amount: s.amount_total ?? 0, currency: s.currency || "usd", token: token(),
    payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || "",
  });
  await deliver(env, s.id, origin);
  return orderBy(env, "id", s.id);
}

/** Email the buyer their link (once) and tell the owner. Never throws: the thanks page always shows the link. */
async function deliver(env, orderId, origin) {
  if (!env.RESEND_API_KEY) return;
  try {
    const claim = await env.DB.prepare("UPDATE store_orders SET emailed = 1 WHERE id = ? AND emailed = 0").bind(orderId).run();
    if (!claim.meta?.changes) return;
    const o = await orderBy(env, "id", orderId), p = await getProduct(env, o.product_id), name = p?.name || "your download";
    const link = `${origin}/store/thanks/?order=${o.token}`; // the page, not the file: mail scanners that open links won't burn downloads
    if (o.email) {
      try {
        await sendEmail(env, { to: o.email, replyTo: env.CONTACT_TO, subject: `Your download: ${name}`,
          html: `<p>Thanks${o.amount ? " for your purchase" : ""}! Your copy of <b>${esc(name)}</b> is ready.</p><p><a href="${link}" style="display:inline-block;background:#3f7bd9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Download ${esc(name)}</a></p><p style="color:#666">The link works up to ${DOWNLOAD_LIMIT} times. Keep this email to download again later. Questions? Just reply.</p><p style="color:#666">BardalesLabs · Miami, FL</p>` });
      } catch (e) {
        await env.DB.prepare("UPDATE store_orders SET emailed = 0 WHERE id = ?").bind(orderId).run();
        throw e;
      }
    }
    await sendEmail(env, { to: env.CONTACT_TO || "alonso@bardaleslabs.com", subject: `${o.amount ? `New sale: ${name} (${priceLabel(o.amount)})` : `New free download: ${name}`}`,
      html: `<p><b>${esc(name)}</b> · ${o.amount ? priceLabel(o.amount) : "free"} · ${esc(o.email || "no email")}</p><p>Order <code>${esc(o.id)}</code>. Details in the admin under Store.</p>` }).catch(e => console.error("owner email", e));
  } catch (e) { console.error("deliver", e); }
}

// ---------- webhook: POST /api/store/webhook
// Stripe dashboard → Developers → Webhooks → add https://<your domain>/api/store/webhook with events
// checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded.
export async function webhook(request, env) {
  const payload = await request.text();
  if (!await verifySignature(env.STRIPE_WEBHOOK_SECRET, payload, request.headers.get("stripe-signature"))) return text("bad signature", 400);
  const ev = JSON.parse(payload), o = ev.data?.object, origin = new URL(request.url).origin;
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") await fulfill(env, o, origin);
  else if (ev.type === "charge.refunded" && o?.refunded && o.payment_intent) await env.DB.prepare("UPDATE store_orders SET status = 'refunded' WHERE payment_intent = ?").bind(String(o.payment_intent)).run();
  return json({ received: true });
}

const enc = new TextEncoder();
export async function verifySignature(secret, payload, header, now = Date.now()) {
  if (!secret || !header) return false;
  const kv = header.split(",").map(s => s.trim().split("=")), t = kv.find(([k]) => k === "t")?.[1], sigs = kv.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)))].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.some(s => safeEqual(s, mac));
}

// ---------- /store/thanks/?session_id=cs_... (Stripe redirect) or ?order=<token> (email link, free downloads)
export async function thanksData(env, url) {
  const sid = url.searchParams.get("session_id") || "", tok = url.searchParams.get("order") || "";
  let order = null;
  if (SESSION.test(sid)) {
    order = await orderBy(env, "id", sid);
    if (!order && stripeReady(env)) { // webhook hasn't landed (or isn't set up): confirm with Stripe directly
      const s = await stripe(env, "GET", `/checkout/sessions/${sid}`).catch(() => null);
      order = await fulfill(env, s, url.origin);
      if (!order && s?.metadata?.source === SOURCE && s.status === "complete") return { state: "pending", product: await getProduct(env, s.metadata.product_id) };
    }
  } else if (TOKEN.test(tok)) order = await orderBy(env, "token", tok);
  if (!order) return { state: "missing" };
  return { state: order.status === "refunded" ? "refunded" : "ready", order, product: await getProduct(env, order.product_id) };
}

// ---------- GET /api/store/download/<token>
export async function download(request, env, tok) {
  const fail = (msg, status) => text(`${msg}\n\nNeed help? Email alonso@bardaleslabs.com and include your receipt.`, status, { "content-type": "text/plain; charset=utf-8" });
  if (!TOKEN.test(tok)) return fail("Download link not found.", 404);
  const o = await env.DB.prepare("SELECT o.id, o.status, o.downloads, p.file_key, p.file_name, p.file_type FROM store_orders o JOIN store_products p ON p.id = o.product_id WHERE o.token = ?").bind(tok).first();
  if (!o || !o.file_key || !env.MEDIA) return fail("Download link not found.", 404);
  if (o.status !== "paid") return fail("This order was refunded, so the download is no longer available.", 410);
  if (o.downloads >= DOWNLOAD_LIMIT) return fail(`This link has been used ${DOWNLOAD_LIMIT} times. Reply to your receipt email and we'll send a fresh one.`, 429);
  const obj = await env.MEDIA.get(o.file_key);
  if (!obj) return fail("The file is missing on our side. We'll fix it right away.", 404);
  await env.DB.prepare("UPDATE store_orders SET downloads = downloads + 1 WHERE id = ?").bind(o.id).run();
  const name = o.file_name || o.file_key.split("/").pop();
  return new Response(obj.body, { headers: {
    "content-type": o.file_type || obj.httpMetadata?.contentType || "application/octet-stream", "content-length": String(obj.size),
    "content-disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "cache-control": "private, no-store", "x-robots-tag": "noindex",
  } });
}

// ---------- admin: /api/admin/products, /api/admin/orders
const str = (v, max) => String(v ?? "").trim().slice(0, max);
function cleanProduct(b) {
  const price = Math.round(Number(b.price) || 0);
  return {
    status: ["draft", "live", "archived"].includes(b.status) ? b.status : "draft",
    name: str(b.name, 120), kind: str(b.kind, 60), price: price > 0 ? price : 0,
    short: str(b.short, 300), body: str(b.body, 10000), features: str(b.features, 4000),
    cover: PHOTO_ID.test(b.cover || "") ? b.cover : null,
    file_key: FILE_KEY.test(b.file_key || "") ? b.file_key : null, file_name: str(b.file_name, 180) || null,
    file_size: Math.max(0, Math.round(Number(b.file_size) || 0)) || null, file_type: str(b.file_type, 120) || null,
    sort: Math.round(Number(b.sort) || 0),
  };
}
const P_FIELDS = ["status", "name", "kind", "price", "short", "body", "features", "cover", "file_key", "file_name", "file_size", "file_type", "sort"];

export async function productsAdmin(request, env) {
  try {
    if (request.method === "GET") {
      const [products, sales] = await env.DB.batch([
        env.DB.prepare("SELECT * FROM store_products ORDER BY sort, created_at DESC"),
        env.DB.prepare("SELECT product_id, COUNT(*) orders, SUM(amount) revenue FROM store_orders WHERE status = 'paid' GROUP BY product_id"),
      ]);
      return json({ products: products.results, sales: sales.results, stripe: stripeReady(env), webhook: !!env.STRIPE_WEBHOOK_SECRET, email: !!env.RESEND_API_KEY, media: !!env.MEDIA });
    }
    const b = await readJson(request); if (!b) return text("bad json", 400);
    const id = String(b.id || "");
    if (request.method === "DELETE") {
      const p = await getProduct(env, id); if (!p) return text("not found", 404);
      const sold = await env.DB.prepare("SELECT COUNT(*) n FROM store_orders WHERE product_id = ?").bind(id).first();
      if (sold.n) return text("This product has orders, so archive it instead. Buyers keep their downloads.", 409);
      await env.DB.prepare("DELETE FROM store_products WHERE id = ?").bind(id).run();
      await deleteImages(env, "products", p.cover ? [p.cover] : []);
      if (p.file_key && env.MEDIA) await env.MEDIA.delete(p.file_key);
      return json({ ok: true });
    }
    if (request.method !== "POST") return text("method not allowed", 405);
    const p = cleanProduct(b);
    if (!p.name) return text("Give the product a name.", 422);
    if (p.price > 0 && p.price < 50) return text("Stripe's minimum is $0.50. Use 0 for a free download.", 422);
    if (p.status === "live" && !p.file_key) return text("Upload the file buyers get before publishing.", 422);
    const vals = P_FIELDS.map(f => p[f]), now = Date.now();
    const old = await getProduct(env, id);
    if (b.create) {
      if (!PRODUCT_ID.test(id) || RESERVED.has(id)) return text("The URL name can use lowercase letters, numbers and dashes.", 422);
      if (old) return text(`/store/${id}/ is taken. Pick another URL name.`, 409);
      await env.DB.prepare(`INSERT INTO store_products (id, ${P_FIELDS.join(", ")}, created_at, updated_at) VALUES (?, ${P_FIELDS.map(() => "?").join(", ")}, ?, ?)`).bind(id, ...vals, now, now).run();
    } else {
      if (!old) return text("not found", 404);
      await env.DB.prepare(`UPDATE store_products SET ${P_FIELDS.map(f => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, now, id).run();
      if (old.cover && old.cover !== p.cover) await deleteImages(env, "products", [old.cover]);
      if (old.file_key && old.file_key !== p.file_key && env.MEDIA) await env.MEDIA.delete(old.file_key); // buyers get the new version
    }
    return json({ ok: true, product: await getProduct(env, id) });
  } catch (e) {
    if (noTable(e)) return json({ error: MIGRATE }, 503);
    throw e;
  }
}

export async function ordersAdmin(request, env) {
  try {
    return json((await env.DB.prepare("SELECT o.*, p.name product_name FROM store_orders o LEFT JOIN store_products p ON p.id = o.product_id ORDER BY o.created_at DESC LIMIT 300").all()).results);
  } catch (e) {
    if (noTable(e)) return json([]);
    throw e;
  }
}
