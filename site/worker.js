// Cloudflare Worker: static site (dist/) + analytics beacon + admin API + contact form.
import { onRequestPost as contact } from "./functions/api/contact.js";
import { collect, tracker } from "./src/api/collect.js";
import { login, logout, isAdmin, unauthorized } from "./src/api/auth.js";
import { stats, items, downloads, inbox, settings, github } from "./src/api/admin.js";
import { ascEndpoint, pullDay } from "./src/api/appstore.js";
import { json } from "./src/api/util.js";

const ADMIN = { stats, items, downloads, inbox, settings, github, appstore: ascEndpoint };

export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (p === "/t.js") return tracker();
    if (p === "/api/collect") return collect(request, env);
    if (p === "/api/contact") return request.method === "POST" ? contact({ request, env }) : new Response("method not allowed", { status: 405 });
    if (p === "/api/admin/login") return request.method === "POST" ? login(request, env) : new Response("method not allowed", { status: 405 });
    if (p === "/api/admin/logout") return logout();
    if (p === "/api/admin/me") return json({ admin: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD });
    if (p.startsWith("/api/admin/")) {
      if (!await isAdmin(request, env)) return unauthorized();
      const fn = ADMIN[p.slice("/api/admin/".length).split("/")[0]];
      return fn ? fn(request, env) : new Response("not found", { status: 404 });
    }
    if (p.startsWith("/api/")) return new Response("not found", { status: 404 });
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
