export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
export const text = (s, status = 200, headers = {}) => new Response(s, { status, headers });
export const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" };

export async function readJson(request) { try { return await request.json(); } catch { return null; } }

const enc = new TextEncoder();
export async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const safeEqual = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export function cookie(request, name) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

export function device(ua = "") {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}
export function browser(ua = "") {
  if (/Edg\//.test(ua)) return "Edge"; if (/OPR\//.test(ua)) return "Opera"; if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari"; if (/Firefox\//.test(ua)) return "Firefox"; return "Other";
}
export const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

// ids, tokens and slugs
const ALPHA = "abcdefghijklmnopqrstuvwxyz0123456789";
export const rid = (n = 12) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => ALPHA[b % 36]).join("");
export const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const slugify = (s, max = 48) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
/** D1 error for a table that hasn't been created yet (schema.sql not applied). */
export const noTable = (e) => /no such table/i.test(String(e?.message || e));
export const MIGRATE = "Database tables are missing. Run `npm run db:migrate` in site/ (safe to re-run).";
