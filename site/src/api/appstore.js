// App Store Connect: daily SALES/SUMMARY report -> downloads table. Needs ASC_ISSUER_ID, ASC_KEY_ID,
// ASC_PRIVATE_KEY (the .p8 contents) and ASC_VENDOR_NUMBER. Apps are matched by SKU or Apple ID via settings.
import { json, day } from "./util.js";

const REQUIRED = ["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_VENDOR_NUMBER"];
export const ascStatus = (env) => ({ configured: REQUIRED.every(k => env[k]), missing: REQUIRED.filter(k => !env[k]) });

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function jwt(env) {
  const pem = env.ASC_PRIVATE_KEY.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const h = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: env.ASC_KEY_ID, typ: "JWT" })));
  const p = b64url(enc.encode(JSON.stringify({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}

/** Fetch one day's sales report and upsert per-app units. Returns { day, apps: {sku: units} } */
export async function pullDay(env, d = day(Date.now() - 864e5)) {
  if (!ascStatus(env).configured) return { error: "not configured" };
  const params = new URLSearchParams({ "filter[frequency]": "DAILY", "filter[reportDate]": d, "filter[reportSubType]": "SUMMARY", "filter[reportType]": "SALES", "filter[vendorNumber]": env.ASC_VENDOR_NUMBER });
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, { headers: { authorization: `Bearer ${await jwt(env)}`, accept: "application/a-gzip" } });
  if (res.status === 404) return { day: d, apps: {}, note: "no report for that day yet" };
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  const tsv = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
  const [head, ...rows] = tsv.trim().split("\n").map(l => l.split("\t"));
  const col = (n) => head.indexOf(n), iSku = col("SKU"), iUnits = col("Units"), iType = col("Product Type Identifier"), iName = col("Title");
  const apps = {};
  for (const r of rows) {
    if (!/^1|^F1/.test(r[iType] || "")) continue; // 1 / 1F / 1T... = app downloads; skip IAP/updates(7)
    const key = r[iSku] || r[iName]; apps[key] = (apps[key] || 0) + (+r[iUnits] || 0);
  }
  for (const [sku, units] of Object.entries(apps)) await env.DB.prepare("INSERT INTO downloads (app_id, day, units, source) VALUES (?,?,?,'appstore') ON CONFLICT(app_id, day, source) DO UPDATE SET units = excluded.units").bind(sku, d, units).run();
  return { day: d, apps };
}

export async function ascEndpoint(request, env) {
  if (request.method === "POST") { const d = new URL(request.url).searchParams.get("day"); return json(await pullDay(env, d || undefined)); }
  return json(ascStatus(env));
}
