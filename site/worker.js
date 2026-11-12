// Cloudflare Worker: static site (dist/) + analytics beacon + admin API + contact form
// + Miami-Dade car directory and digital store (server-rendered from D1, media in R2).
import { onRequestPost as contact } from "./functions/api/contact.js";
import { collect, tracker } from "./src/api/collect.js";
import { login, logout, isAdmin, unauthorized } from "./src/api/auth.js";
import { stats, items, downloads, inbox, settings, github } from "./src/api/admin.js";
import { ascEndpoint, pullDay } from "./src/api/appstore.js";
import { serveMedia, uploadImage, fileUpload } from "./src/api/media.js";
import { carsAdmin, vin } from "./src/api/cars.js";
import { checkout, webhook, download, productsAdmin, ordersAdmin } from "./src/api/store.js";
import { carsRoute, storeRoute, sitemap } from "./src/api/ssr.js";
import { json } from "./src/api/util.js";

const ADMIN = { stats, items, downloads, inbox, settings, github, appstore: ascEndpoint, cars: carsAdmin, vin, upload: uploadImage, file: fileUpload, products: productsAdmin, orders: ordersAdmin };
const POST_ONLY = (fn) => (request, env) => request.method === "POST" ? fn(request, env) : new Response("method not allowed", { status: 405 });

export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (p === "/t.js") return tracker();
    if (p === "/api/collect") return collect(request, env);
    if (p === "/api/contact") return request.method === "POST" ? contact({ request, env }) : new Response("method not allowed", { status: 405 });
    if (p === "/api/store/checkout") return POST_ONLY(checkout)(request, env);
    if (p === "/api/store/webhook") return POST_ONLY(webhook)(request, env);
    if (p.startsWith("/api/store/download/")) return download(request, env, p.slice("/api/store/download/".length));
    if (p === "/api/admin/login") return request.method === "POST" ? login(request, env) : new Response("method not allowed", { status: 405 });
    if (p === "/api/admin/logout") return logout();
    if (p === "/api/admin/me") return json({ admin: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD });
    if (p.startsWith("/api/admin/")) {
      if (!await isAdmin(request, env)) return unauthorized();
      const fn = ADMIN[p.slice("/api/admin/".length).split("/")[0]];
      return fn ? fn(request, env) : new Response("not found", { status: 404 });
    }
    if (p.startsWith("/api/")) return new Response("not found", { status: 404 });
    if (p.startsWith("/media/")) return serveMedia(request, env);
    if (p === "/cars" || p.startsWith("/cars/")) return carsRoute(request, env);
    if (p === "/store" || p.startsWith("/store/")) return storeRoute(request, env);
    if (p === "/sitemap.xml") return sitemap(request, env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      try { await pullDay(env); } catch (e) { console.error("asc", e); }
      // keep 18 months of raw events
      await env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(Date.now() - 548 * 864e5).run();
    })());
  },
};
