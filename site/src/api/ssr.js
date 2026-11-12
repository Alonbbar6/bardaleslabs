// Server-rendered pages. Vite builds a shell per section (nav, footer, hashed CSS/JS); the Worker fills it per request.
import { html, esc, headMeta } from "../render/layout.mjs";
import { carsIndexBody, carsIndexHead, carDetailBody, carHead, carNotFoundBody } from "../render/cars.mjs";
import { storeIndexBody, digitalBody, digitalHead, thanksBody, STORE_DESCRIPTION } from "../render/store.mjs";
import { listCars, carFacets, carFilters, getCar, moreCars, listedCarIds, CAR_ID, PAGE_SIZE } from "./cars.js";
import { listProducts, getProduct, thanksData, stripeReady, PRODUCT_ID } from "./store.js";
import { isAdmin } from "./auth.js";
import { noTable, MIGRATE, see } from "./util.js";
import { company } from "../data/company.js";
import { work } from "../data/work.js";
import { products } from "../data/products.js";

async function render(env, request, section, { head, body, status = 200 }) {
  const shell = await env.ASSETS.fetch(new Request(new URL(`/${section}/_shell/`, request.url)));
  if (!shell.ok) return new Response(`Missing /${section}/_shell/. Run npm run build.`, { status: 500 });
  // replacer functions: listing text may contain "$&" and friends
  const out = (await shell.text()).replace("<!--ssr:head-->", () => headMeta(head)).replace("<!--ssr:body-->", () => body);
  return new Response(out, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
}
const slashed = (url) => url.pathname.endsWith("/") ? null : see(`${url.pathname}/${url.search}`, 301);
const banner = (msg, href) => html`<div class="wrap"><p class="notice notice--admin">${esc(msg)} <a href="${href}">Edit in admin →</a></p></div>`;
const adminNotice = (e) => html`<p class="notice notice--admin">${esc(noTable(e) ? MIGRATE : `Database error: ${e.message}`)} (Only you see this.)</p>`;

// ---------- /cars/ and /cars/<id>/
export async function carsRoute(request, env) {
  const url = new URL(request.url), redirect = slashed(url);
  if (redirect) return redirect;
  const parts = url.pathname.split("/").filter(Boolean), origin = url.origin;
  if (parts.length === 1) {
    const f = carFilters(url.searchParams);
    let data = { cars: [], total: 0, facets: { makes: [], bodies: [], areas: [], total: 0 } }, notice = "";
    try {
      const [list, facets] = await Promise.all([listCars(env, f), carFacets(env)]);
      data = { ...list, facets };
    } catch (e) {
      console.error("cars", e);
      if (await isAdmin(request, env)) notice = adminNotice(e);
    }
    const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    return render(env, request, "cars", { head: carsIndexHead(origin, f, data.total), body: carsIndexBody({ ...data, f, page: f.page, pages, notice }) });
  }
  if (parts.length === 2 && CAR_ID.test(parts[1])) {
    const car = await getCar(env, parts[1]).catch(() => null), admin = car?.status === "draft" && await isAdmin(request, env);
    if (car && (car.status !== "draft" || admin)) {
      const more = car.status === "draft" ? [] : await moreCars(env, car).catch(() => []);
      return render(env, request, "cars", { head: carHead(car, origin), body: carDetailBody(car, { more, origin, banner: admin ? banner("Draft: only you can see this listing.", `/admin/#cars/${car.id}`) : "" }) });
    }
  }
  return render(env, request, "cars", { head: { title: "Listing not found · BardalesLabs Cars", description: "This car listing isn't available.", noindex: true }, body: carNotFoundBody(), status: 404 });
}

// ---------- /store/, /store/thanks/, /store/<digital product>/ (anything else is a static page from dist/)
export async function storeRoute(request, env) {
  const url = new URL(request.url), redirect = slashed(url);
  if (redirect) return redirect;
  const parts = url.pathname.split("/").filter(Boolean), origin = url.origin;
  if (parts.length === 1) {
    const digital = await listProducts(env).catch(e => { console.error("store", e); return []; });
    return render(env, request, "store", { head: { title: "Store — BardalesLabs", description: STORE_DESCRIPTION, url: `${origin}/store/` }, body: storeIndexBody(digital) });
  }
  if (parts.length === 2 && parts[1] === "thanks") {
    const data = await thanksData(env, url).catch(e => { console.error("thanks", e); return { state: "error" }; });
    return render(env, request, "store", { head: { title: "Your download · BardalesLabs Store", description: "Order confirmation.", noindex: true }, body: thanksBody(data) });
  }
  if (parts.length === 2 && PRODUCT_ID.test(parts[1])) {
    const p = await getProduct(env, parts[1]).catch(() => null);
    const preview = p && p.status !== "live" && await isAdmin(request, env);
    if (p && (p.status === "live" || preview)) {
      return render(env, request, "store", { head: digitalHead(p, origin), body: digitalBody(p, {
        checkout: stripeReady(env), notice: url.searchParams.get("checkout") || "",
        banner: preview ? banner(`${p.status === "draft" ? "Draft" : "Archived"}: only you can see this page.`, `/admin/#store/${p.id}`) : "",
      }) });
    }
  }
  return env.ASSETS.fetch(request); // software pages from data/products.js, or the 404 page
}

// ---------- /sitemap.xml
export async function sitemap(request, env) {
  const o = new URL(request.url).origin;
  const fixed = ["/", ...company.nav.map(n => n.href), "/contact/", ...work.map(w => `/work/${w.id}/`), ...products.map(p => `/store/${p.id}/`)];
  const [cars, digital] = await Promise.all([listedCarIds(env).catch(() => []), listProducts(env).catch(() => [])]);
  const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
  const urls = [...new Set(fixed)].map(p => [p, ""]).concat(cars.map(c => [`/cars/${c.id}/`, day(c.updated_at)]), digital.map(p => [`/store/${p.id}/`, day(p.updated_at)]));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, d]) => `<url><loc>${esc(o + p)}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
