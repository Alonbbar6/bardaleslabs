// Admin data endpoints (all behind isAdmin).
import { json, text, readJson, day } from "./util.js";

const q = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).all().then(r => r.results);

export async function stats(request, env) {
  const u = new URL(request.url), days = Math.min(365, Math.max(1, +u.searchParams.get("days") || 30)), prop = u.searchParams.get("property") || "";
  const since = Date.now() - days * 864e5, prev = since - days * 864e5;
  const where = prop ? "AND property = ?" : "", args = prop ? [prop] : [];
  const pv = "type = 'pageview'";
  const [totals, prevTotals, daily, pages, refs, countries, devices, browsers, events, props] = await Promise.all([
    q(env, `SELECT COUNT(*) views, COUNT(DISTINCT sid) visitors FROM events WHERE ${pv} AND ts >= ? ${where}`, since, ...args),
    q(env, `SELECT COUNT(*) views, COUNT(DISTINCT sid) visitors FROM events WHERE ${pv} AND ts >= ? AND ts < ? ${where}`, prev, since, ...args),
    q(env, `SELECT date(ts/1000,'unixepoch') d, COUNT(*) views, COUNT(DISTINCT sid) visitors FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY d ORDER BY d`, since, ...args),
    q(env, `SELECT path k, COUNT(*) n FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY path ORDER BY n DESC LIMIT 12`, since, ...args),
    q(env, `SELECT COALESCE(NULLIF(referrer,''),'direct') k, COUNT(*) n FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY k ORDER BY n DESC LIMIT 10`, since, ...args),
    q(env, `SELECT COALESCE(NULLIF(country,''),'?') k, COUNT(*) n FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY k ORDER BY n DESC LIMIT 10`, since, ...args),
    q(env, `SELECT device k, COUNT(*) n FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY k ORDER BY n DESC`, since, ...args),
    q(env, `SELECT browser k, COUNT(*) n FROM events WHERE ${pv} AND ts >= ? ${where} GROUP BY k ORDER BY n DESC`, since, ...args),
    q(env, `SELECT name k, COUNT(*) n FROM events WHERE type = 'event' AND ts >= ? ${where} GROUP BY k ORDER BY n DESC LIMIT 15`, since, ...args),
    q(env, `SELECT property k, COUNT(*) n, MAX(ts) last FROM events WHERE ${pv} AND ts >= ? GROUP BY k ORDER BY n DESC`, since),
  ]);
  // fill missing days with zeros
  const map = Object.fromEntries(daily.map(r => [r.d, r])), series = [];
  for (let i = days - 1; i >= 0; i--) { const d = day(Date.now() - i * 864e5); series.push({ d, views: map[d]?.views || 0, visitors: map[d]?.visitors || 0 }); }
  return json({ days, property: prop, totals: totals[0], prev: prevTotals[0], series, pages, refs, countries, devices, browsers, events, properties: props });
}

export async function items(request, env) {
  if (request.method === "GET") return json(await q(env, "SELECT * FROM items ORDER BY type, name"));
  const b = await readJson(request); if (!b?.id || !b?.name || !b?.type) return text("missing id/name/type", 422);
  if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(b.id).run(); return json({ ok: true }); }
  await env.DB.prepare(`INSERT INTO items (id,type,name,status,url,store_url,repo,property,notes,next_action,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,status=excluded.status,url=excluded.url,store_url=excluded.store_url,repo=excluded.repo,property=excluded.property,notes=excluded.notes,next_action=excluded.next_action,updated_at=excluded.updated_at`)
    .bind(b.id, b.type, b.name, b.status || "live", b.url || "", b.store_url || "", b.repo || "", b.property || "", b.notes || "", b.next_action || "", Date.now()).run();
  return json({ ok: true });
}

export async function downloads(request, env) {
  if (request.method === "GET") {
    const u = new URL(request.url), days = Math.min(365, +u.searchParams.get("days") || 90), since = day(Date.now() - days * 864e5);
    const rows = await q(env, "SELECT app_id, day, SUM(units) units FROM downloads WHERE day >= ? GROUP BY app_id, day ORDER BY day", since);
    const totals = await q(env, "SELECT app_id, SUM(units) total, MAX(day) last FROM downloads GROUP BY app_id");
    return json({ rows, totals });
  }
  const b = await readJson(request); if (!b?.app_id || !b?.day) return text("missing app_id/day", 422);
  await env.DB.prepare("INSERT INTO downloads (app_id, day, units, source) VALUES (?,?,?,'manual') ON CONFLICT(app_id, day, source) DO UPDATE SET units = excluded.units").bind(b.app_id, b.day, +b.units || 0).run();
  return json({ ok: true });
}

export async function inbox(request, env) {
  if (request.method === "GET") return json(await q(env, "SELECT * FROM inbox ORDER BY ts DESC LIMIT 200"));
  const b = await readJson(request); if (!b?.id) return text("missing id", 422);
  await env.DB.prepare("UPDATE inbox SET status = ? WHERE id = ?").bind(b.status || "new", b.id).run();
  return json({ ok: true });
}

export async function settings(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (request.method === "GET") return json({ ...Object.fromEntries((await q(env, "SELECT key, value FROM settings")).map(r => [r.key, r.value])), __ip: ip, __resend: !!env.RESEND_API_KEY });
  const b = await readJson(request); if (!b || typeof b !== "object") return text("bad", 400);
  for (const [k, v] of Object.entries(b)) await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, String(v)).run();
  return json({ ok: true });
}

// GitHub repo health, proxied so the browser doesn't hit rate limits per repo
export async function github(request, env) {
  const repos = (new URL(request.url).searchParams.get("repos") || "").split(",").filter(Boolean).slice(0, 20);
  const headers = { "user-agent": "bardaleslabs-admin", accept: "application/vnd.github+json", ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) };
  const out = await Promise.all(repos.map(async (r) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${r}`, { headers, cf: { cacheTtl: 600, cacheEverything: true } });
      if (!res.ok) return { repo: r, error: res.status };
      const j = await res.json();
      return { repo: r, stars: j.stargazers_count, issues: j.open_issues_count, pushed: j.pushed_at, lang: j.language, private: j.private, url: j.html_url };
    } catch (e) { return { repo: r, error: String(e) }; }
  }));
  return json(out);
}
