import "./admin.css";
import { work } from "../data/work.js";
import { apps } from "../data/apps.js";
import { products } from "../data/products.js";
import { company } from "../data/company.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const api = async (path, opts = {}) => {
  const r = await fetch(`/api/admin/${path}`, { headers: { "content-type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401) { state.authed = false; render(); throw new Error("unauthorized"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
const fmt = (n) => (n ?? 0).toLocaleString();
const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : (a ? 100 : 0);
const ago = (ts) => { const m = Math.round((Date.now() - ts) / 6e4); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

// Everything the public site knows about, as the baseline inventory. D1 `items` overrides/extends it.
const BASE_ITEMS = [
  { id: "site:bardaleslabs", type: "website", name: "bardaleslabs.com", url: "https://bardaleslabs.alonbbar.workers.dev", property: "bardaleslabs", repo: "Alonbbar6/bardaleslabs" },
  { id: "site:agents", type: "website", name: "Agents at Work", url: company.agentsUrl, property: "agents", repo: "Alonbbar6/bardaleslabs" },
  { id: "site:ptm", type: "website", name: "Priority Task Manager site", url: "", property: "ptm" },
  ...apps.map(a => ({ id: `app:${a.id}`, type: "app", name: a.name, store_url: a.store, status: a.status === "On the App Store" ? "live" : "building" })),
  ...products.map(p => ({ id: `product:${p.id}`, type: "product", name: p.name, url: `/store/${p.id}/` })),
  ...work.filter(w => !w.app).map(w => ({ id: `project:${w.id}`, type: "project", name: w.title, url: `/work/${w.id}/`, status: w.kind === "Product" || w.year === "2026" ? "live" : "paused" })),
  ...company.partners.map(p => ({ id: `company:${p.toLowerCase().replace(/\W+/g, "-")}`, type: "company", name: p })),
];
const TYPES = ["website", "app", "product", "project", "company"], STATUSES = ["live", "building", "paused", "idea"];

const state = { authed: false, configured: true, tab: location.hash.slice(1) || "overview", days: 30, property: "", stats: null, items: [], downloads: null, inbox: [], settings: {}, gh: [], asc: null, loading: false, err: "" };
const root = $("#app");

// ---------- charts (canvas, no deps)
function lineChart(canvas, series, keys = ["views", "visitors"], colors = ["#6ea0ff", "#2fb85a"]) {
  const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const pad = { l: 36, r: 8, t: 10, b: 22 }, max = Math.max(1, ...series.flatMap(s => keys.map(k => s[k])));
  const x = (i) => pad.l + (i / Math.max(1, series.length - 1)) * (W - pad.l - pad.r), y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  g.strokeStyle = "rgba(255,255,255,.08)"; g.fillStyle = "#9aa3b2"; g.font = "11px system-ui"; g.textAlign = "right";
  for (let i = 0; i <= 4; i++) { const v = Math.round((max / 4) * i), yy = y(v); g.beginPath(); g.moveTo(pad.l, yy); g.lineTo(W - pad.r, yy); g.stroke(); g.fillText(fmt(v), pad.l - 6, yy + 4); }
  g.textAlign = "center"; const step = Math.ceil(series.length / 8);
  series.forEach((s, i) => { if (i % step === 0) g.fillText(s.d.slice(5), x(i), H - 6); });
  keys.forEach((k, ki) => {
    g.beginPath(); series.forEach((s, i) => { const px = x(i), py = y(s[k]); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.strokeStyle = colors[ki]; g.lineWidth = 2; g.stroke();
    if (ki === 0) { g.lineTo(x(series.length - 1), y(0)); g.lineTo(x(0), y(0)); g.closePath(); g.fillStyle = "rgba(110,160,255,.12)"; g.fill(); }
  });
}
function bars(rows, total) { return rows.length ? rows.map(r => `<li><span>${esc(r.k)}</span><i style="width:${Math.max(2, (r.n / (total || rows[0].n)) * 100)}%"></i><b>${fmt(r.n)}</b></li>`).join("") : `<li class="empty">No data yet</li>`; }

// ---------- views
function loginView() {
  return `<div class="login"><form data-login>
    <h1>Bardales<span>Labs</span> admin</h1>
    ${state.configured ? "" : `<p class="warn">ADMIN_PASSWORD isn't set on the Worker yet. Run <code>npx wrangler secret put ADMIN_PASSWORD</code>.</p>`}
    <label>Password<input type="password" name="password" autocomplete="current-password" autofocus /></label>
    <button class="btn">Sign in</button><p class="err">${esc(state.err)}</p>
  </form></div>`;
}

function shell(content) {
  const tabs = [["overview", "Overview"], ["portfolio", "Portfolio"], ["analytics", "Analytics"], ["apps", "Apps & downloads"], ["inbox", `Inbox${state.inbox.filter(i => i.status === "new").length ? ` <em>${state.inbox.filter(i => i.status === "new").length}</em>` : ""}`], ["settings", "Settings"]];
  return `<div class="shell"><aside class="side"><a class="brand" href="/">Bardales<span>Labs</span></a><nav>${tabs.map(([k, l]) => `<a href="#${k}" class="${state.tab === k ? "is-on" : ""}">${l}</a>`).join("")}</nav><button class="link" data-logout>Sign out</button></aside>
  <main class="main">${state.err ? `<p class="err">${esc(state.err)}</p>` : ""}${content}</main></div>`;
}

const rangeBar = () => `<div class="bar"><div class="seg">${[7, 30, 90, 365].map(d => `<button data-days="${d}" class="${state.days === d ? "is-on" : ""}">${d}d</button>`).join("")}</div>
  <select data-property><option value="">All properties</option>${(state.stats?.properties || []).map(p => `<option value="${esc(p.k)}" ${state.property === p.k ? "selected" : ""}>${esc(p.k)} (${fmt(p.n)})</option>`).join("")}</select></div>`;

function overview() {
  const s = state.stats, t = s?.totals || {}, p = s?.prev || {};
  const live = state.items.filter(i => i.status === "live").length, building = state.items.filter(i => i.status === "building").length;
  const dl = state.downloads?.totals?.reduce((a, r) => a + r.total, 0) || 0;
  return `<header class="head"><h1>Overview</h1>${rangeBar()}</header>
  <div class="kpis">
    ${kpi("Visitors", t.visitors, pct(t.visitors, p.visitors))}${kpi("Page views", t.views, pct(t.views, p.views))}
    ${kpi("Leads in inbox", state.inbox.filter(i => i.status === "new").length)}${kpi("App downloads (all time)", dl)}
    ${kpi("Live", live)}${kpi("Building", building)}
  </div>
  <section class="card"><h2>Traffic · last ${state.days} days</h2><canvas class="chart" data-chart></canvas><p class="legend"><i style="background:#6ea0ff"></i>views <i style="background:#2fb85a"></i>visitors</p></section>
  <div class="grid2">
    <section class="card"><h2>Properties</h2><ul class="bars">${bars((s?.properties || []).map(r => ({ k: r.k, n: r.n })), s?.properties?.[0]?.n)}</ul></section>
    <section class="card"><h2>Conversions · events</h2><ul class="bars">${bars(s?.events || [], s?.events?.[0]?.n)}</ul></section>
  </div>
  <section class="card"><h2>Next actions</h2><ul class="todo">${state.items.filter(i => i.next_action).map(i => `<li><b>${esc(i.name)}</b> ${esc(i.next_action)}</li>`).join("") || "<li class='empty'>Add next actions in Portfolio.</li>"}</ul></section>`;
}
const kpi = (l, v, d) => `<div class="kpi"><span>${l}</span><b>${fmt(v)}</b>${d !== undefined ? `<em class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${d}%</em>` : ""}</div>`;

function analytics() {
  const s = state.stats; if (!s) return `<p>Loading…</p>`;
  return `<header class="head"><h1>Analytics</h1>${rangeBar()}</header>
  <div class="kpis">${kpi("Visitors", s.totals.visitors, pct(s.totals.visitors, s.prev.visitors))}${kpi("Page views", s.totals.views, pct(s.totals.views, s.prev.views))}${kpi("Views / visitor", s.totals.visitors ? (s.totals.views / s.totals.visitors).toFixed(1) : 0)}</div>
  <section class="card"><canvas class="chart" data-chart></canvas></section>
  <div class="grid2">
    <section class="card"><h2>Top pages</h2><ul class="bars">${bars(s.pages, s.totals.views)}</ul></section>
    <section class="card"><h2>Referrers</h2><ul class="bars">${bars(s.refs, s.totals.views)}</ul></section>
    <section class="card"><h2>Countries</h2><ul class="bars">${bars(s.countries, s.totals.views)}</ul></section>
    <section class="card"><h2>Devices</h2><ul class="bars">${bars(s.devices, s.totals.views)}</ul><h2>Browsers</h2><ul class="bars">${bars(s.browsers, s.totals.views)}</ul></section>
    <section class="card wide"><h2>Events</h2><ul class="bars">${bars(s.events, s.events[0]?.n)}</ul></section>
  </div>
  <section class="card"><h2>Add tracking to any site</h2><p class="muted">Paste before <code>&lt;/body&gt;</code>. Use a short property name per site.</p>
  <pre>&lt;script defer src="${location.origin}/t.js" data-property="my-site"&gt;&lt;/script&gt;</pre>
  <p class="muted">Custom events: <code>blTrack("signup")</code>. Buttons with <code>data-track="name"</code>, <code>.btn</code> clicks, mailto and outbound links are tracked automatically.</p></section>`;
}

function portfolio() {
  const groups = TYPES.map(t => [t, state.items.filter(i => i.type === t)]);
  const gh = Object.fromEntries(state.gh.map(g => [g.repo, g]));
  return `<header class="head"><h1>Portfolio</h1><button class="btn" data-new>+ Add item</button></header>
  ${groups.map(([t, rows]) => `<section class="card"><h2>${t === "company" ? "companies" : t + "s"} <small>${rows.length}</small></h2><table class="tbl"><thead><tr><th>Name</th><th>Status</th><th>Links</th><th>Repo</th><th>Next action</th><th></th></tr></thead><tbody>
    ${rows.map(i => `<tr data-id="${esc(i.id)}"><td><b>${esc(i.name)}</b>${i.notes ? `<small>${esc(i.notes)}</small>` : ""}</td>
      <td><span class="pill pill--${i.status}">${i.status}</span></td>
      <td class="links">${i.url ? `<a href="${esc(i.url)}" target="_blank">site ↗</a>` : ""}${i.store_url ? `<a href="${esc(i.store_url)}" target="_blank">store ↗</a>` : ""}${i.property ? `<a href="#analytics" data-prop="${esc(i.property)}">analytics</a>` : ""}</td>
      <td>${i.repo ? (gh[i.repo] ? `<small>${gh[i.repo].error ? "n/a" : `★ ${gh[i.repo].stars} · ${gh[i.repo].issues} issues · ${ago(new Date(gh[i.repo].pushed).getTime())}`}</small>` : `<small>${esc(i.repo)}</small>`) : ""}</td>
      <td>${esc(i.next_action)}</td><td><button class="link" data-edit="${esc(i.id)}">Edit</button></td></tr>`).join("")}
  </tbody></table></section>`).join("")}
  <dialog data-dialog><form method="dialog" data-item-form><h2>Item</h2>
    <label>Name<input name="name" required /></label><label>ID<input name="id" required /></label>
    <div class="row"><label>Type<select name="type">${TYPES.map(t => `<option>${t}</option>`).join("")}</select></label><label>Status<select name="status">${STATUSES.map(t => `<option>${t}</option>`).join("")}</select></label></div>
    <label>URL<input name="url" /></label><label>Store URL<input name="store_url" /></label>
    <div class="row"><label>GitHub repo (owner/name)<input name="repo" /></label><label>Analytics property<input name="property" /></label></div>
    <label>Next action<input name="next_action" /></label><label>Notes<textarea name="notes" rows="3"></textarea></label>
    <div class="row end"><button type="button" class="link danger" data-delete>Delete</button><button type="button" class="link" data-cancel>Cancel</button><button class="btn" value="save">Save</button></div>
  </form></dialog>`;
}

function appsView() {
  const d = state.downloads, appItems = state.items.filter(i => i.type === "app");
  const totals = Object.fromEntries((d?.totals || []).map(t => [t.app_id, t]));
  const byApp = {}; for (const r of d?.rows || []) (byApp[r.app_id] ??= []).push(r);
  return `<header class="head"><h1>Apps & downloads</h1></header>
  <div class="grid2">${appItems.map(a => { const key = a.id.replace(/^app:/, ""), t = totals[key]; return `<section class="card"><h2>${esc(a.name)} <span class="pill pill--${a.status}">${a.status}</span></h2>
    <div class="kpis small"><div class="kpi"><span>Downloads (all time)</span><b>${fmt(t?.total)}</b></div><div class="kpi"><span>Last recorded</span><b>${t?.last || "—"}</b></div></div>
    <canvas class="chart sm" data-dl="${esc(key)}"></canvas>
    <form class="row" data-dl-form="${esc(key)}"><label>Day<input type="date" name="day" value="${new Date(Date.now() - 864e5).toISOString().slice(0, 10)}" /></label><label>Downloads<input type="number" name="units" min="0" required /></label><button class="btn">Record</button></form>
    ${a.store_url ? `<a class="muted" href="${esc(a.store_url)}" target="_blank">App Store listing ↗</a>` : `<p class="muted">No App Store link yet — add it in Portfolio.</p>`}
  </section>`; }).join("")}</div>
  <section class="card"><h2>App Store Connect</h2>
  ${state.asc?.configured ? `<p class="ok">Connected. Downloads are pulled daily at 06:30 UTC.</p><button class="btn" data-asc-pull>Pull yesterday now</button>` : `<p class="muted">Not connected. Downloads are manual until you add these Worker secrets: <code>${(state.asc?.missing || []).join("</code>, <code>")}</code>.</p>
  <ol class="steps"><li>App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key with <b>Sales and Reports</b> access. Note the Issuer ID and Key ID, download the .p8 once.</li><li>Payments and Financial Reports → copy the Vendor Number.</li><li>In <code>site/</code> run: <code>npx wrangler secret put ASC_ISSUER_ID</code>, <code>ASC_KEY_ID</code>, <code>ASC_VENDOR_NUMBER</code>, and <code>ASC_PRIVATE_KEY</code> (paste the whole .p8 file).</li><li>Reload this page and click “Pull yesterday now”. Report rows are keyed by SKU; set each app's ID in Portfolio to match the SKU to merge the series.</li></ol>`}
  </section>`;
}

function inboxView() {
  return `<header class="head"><h1>Inbox</h1></header><section class="card">${state.inbox.length ? `<table class="tbl"><thead><tr><th>When</th><th>From</th><th>Interest</th><th>Message</th><th>Status</th></tr></thead><tbody>
  ${state.inbox.map(m => `<tr class="st-${m.status}"><td><small>${ago(m.ts)}</small></td><td><b>${esc(m.name)}</b><small><a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.company ? ` · ${esc(m.company)}` : ""}</small></td><td><small>${esc(m.interest)}</small></td><td>${esc(m.message)}<small>${esc(m.page)}</small></td>
    <td><select data-inbox="${m.id}">${["new", "replied", "archived"].map(s => `<option ${m.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>` : `<p class="muted">No submissions yet. Everything sent through the contact form lands here (and by email once Resend is set).</p>`}</section>`;
}

function settingsView() {
  return `<header class="head"><h1>Settings</h1></header>
  <section class="card"><h2>Secrets on the Worker</h2><table class="tbl"><tbody>
    <tr><td>ADMIN_PASSWORD</td><td><span class="pill pill--live">set</span></td><td>You're signed in, so this exists.</td></tr>
    <tr><td>RESEND_API_KEY</td><td><span class="pill pill--${state.settings.__resend ? "live" : "paused"}">${state.settings.__resend ? "set" : "unknown"}</span></td><td>Contact form email. Submissions are stored in Inbox regardless.</td></tr>
    <tr><td>ASC_*</td><td><span class="pill pill--${state.asc?.configured ? "live" : "paused"}">${state.asc?.configured ? "set" : "missing"}</span></td><td>App Store Connect downloads.</td></tr>
    <tr><td>GITHUB_TOKEN</td><td><span class="pill pill--idea">optional</span></td><td>Raises GitHub API limits and allows private repos in Portfolio.</td></tr>
  </tbody></table><p class="muted">Set any of these with <code>npx wrangler secret put NAME</code> inside <code>site/</code>, then <code>npm run deploy</code>.</p></section>
  <section class="card"><h2>Don't count me</h2>
  <p class="muted">Your own visits are never counted while you're signed in here, and this browser is flagged to skip tracking. To also ignore your other devices on the same network (phone, laptop), exclude your IP:</p>
  <p>Current IP: <code>${esc(state.settings.__ip || "?")}</code> ${(state.settings.exclude_ips || "").split(",").map(s => s.trim()).includes(state.settings.__ip) ? `<span class="pill pill--live">excluded</span>` : `<button class="btn" data-exclude-ip>Exclude my current IP</button>`}</p>
  <label>Excluded IPs (comma separated)<input data-exclude-list value="${esc(state.settings.exclude_ips || "")}" /></label>
  <p class="muted small">Home IPs can change every few weeks; come back and click the button again if your visits start showing up.</p></section>
  <section class="card"><h2>Tracking snippet</h2><pre>&lt;script defer src="${location.origin}/t.js" data-property="my-site"&gt;&lt;/script&gt;</pre></section>
  <section class="card"><h2>Data</h2><p class="muted">Raw events are kept 18 months. Export: <a href="/api/admin/stats?days=365" target="_blank">stats JSON</a> · <a href="/api/admin/inbox" target="_blank">inbox JSON</a> · <a href="/api/admin/items" target="_blank">items JSON</a>.</p></section>`;
}

// ---------- render + data
function render() {
  if (!state.authed) { root.innerHTML = loginView(); return; }
  const view = { overview, analytics, portfolio, apps: appsView, inbox: inboxView, settings: settingsView }[state.tab] || overview;
  root.innerHTML = shell(view());
  const c = $("[data-chart]"); if (c && state.stats) lineChart(c, state.stats.series);
  $$("[data-dl]").forEach(cv => { const rows = (state.downloads?.rows || []).filter(r => r.app_id === cv.dataset.dl); const map = Object.fromEntries(rows.map(r => [r.day, r.units])); const series = []; for (let i = 89; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); series.push({ d, views: map[d] || 0 }); } lineChart(cv, series, ["views"]); });
}

async function loadAll() {
  state.loading = true;
  try {
    const [stats, dbItems, downloads, inbox, settings, asc] = await Promise.all([api(`stats?days=${state.days}&property=${encodeURIComponent(state.property)}`), api("items"), api("downloads?days=90"), api("inbox"), api("settings"), api("appstore")]);
    const over = Object.fromEntries(dbItems.map(i => [i.id, i]));
    state.items = [...BASE_ITEMS.map(b => ({ status: "live", ...b, ...(over[b.id] || {}) })), ...dbItems.filter(i => !BASE_ITEMS.some(b => b.id === i.id))];
    Object.assign(state, { stats, downloads, inbox, settings, asc, err: "" });
    render();
    const repos = [...new Set(state.items.map(i => i.repo).filter(Boolean))];
    if (repos.length) { state.gh = await api(`github?repos=${encodeURIComponent(repos.join(","))}`); if (state.tab === "portfolio") render(); }
  } catch (e) { state.err = e.message; render(); }
  state.loading = false;
}
async function loadStats() { state.stats = await api(`stats?days=${state.days}&property=${encodeURIComponent(state.property)}`); render(); }

// ---------- events
root.addEventListener("submit", async (e) => {
  const f = e.target; e.preventDefault();
  if (f.matches("[data-login]")) { try { state.err = ""; await api("login", { method: "POST", body: { password: new FormData(f).get("password") } }); state.authed = true; try { localStorage.setItem("_bl_ignore", "1"); } catch {} await loadAll(); } catch (err) { state.err = err.message.includes("401") || /wrong/.test(err.message) ? "Wrong password" : err.message; render(); } }
  else if (f.matches("[data-item-form]")) { const d = Object.fromEntries(new FormData(f)); await api("items", { method: "POST", body: d }); $("[data-dialog]").close(); await loadAll(); }
  else if (f.matches("[data-dl-form]")) { const d = Object.fromEntries(new FormData(f)); await api("downloads", { method: "POST", body: { app_id: f.dataset.dlForm, ...d } }); await loadAll(); }
});
root.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a"); if (!t) return;
  if (t.matches("[data-logout]")) { await api("logout", { method: "POST" }); state.authed = false; render(); }
  else if (t.matches("[data-days]")) { state.days = +t.dataset.days; await loadStats(); }
  else if (t.matches("[data-prop]")) { state.property = t.dataset.prop; state.tab = "analytics"; location.hash = "analytics"; await loadStats(); }
  else if (t.matches("[data-new]")) openItem({ id: "", name: "", type: "project", status: "idea" });
  else if (t.matches("[data-edit]")) openItem(state.items.find(i => i.id === t.dataset.edit));
  else if (t.matches("[data-cancel]")) $("[data-dialog]").close();
  else if (t.matches("[data-delete]")) { const id = $("[data-item-form] [name=id]").value; if (confirm(`Delete "${id}" from the admin layer? (Items from the public data files come back as defaults.)`)) { await api("items", { method: "DELETE", body: { id, name: "x", type: "x" } }); $("[data-dialog]").close(); await loadAll(); } }
  else if (t.matches("[data-exclude-ip]")) { const list = [...new Set([...(state.settings.exclude_ips || "").split(",").map(s => s.trim()).filter(Boolean), state.settings.__ip])]; await api("settings", { method: "POST", body: { exclude_ips: list.join(",") } }); await loadAll(); }
  else if (t.matches("[data-asc-pull]")) { t.disabled = true; const r = await api("appstore", { method: "POST" }); alert(JSON.stringify(r, null, 2)); await loadAll(); }
});
root.addEventListener("change", async (e) => {
  if (e.target.matches("[data-exclude-list]")) { await api("settings", { method: "POST", body: { exclude_ips: e.target.value } }); await loadAll(); }
  if (e.target.matches("[data-property]")) { state.property = e.target.value; await loadStats(); }
  if (e.target.matches("[data-inbox]")) { await api("inbox", { method: "POST", body: { id: +e.target.dataset.inbox, status: e.target.value } }); const m = state.inbox.find(i => i.id === +e.target.dataset.inbox); if (m) m.status = e.target.value; render(); }
});
function openItem(item) { const f = $("[data-item-form]"); for (const [k, v] of Object.entries(item)) if (f.elements[k]) f.elements[k].value = v ?? ""; f.elements.id.readOnly = !!item.id; $("[data-dialog]").showModal(); }
addEventListener("hashchange", () => { state.tab = location.hash.slice(1) || "overview"; render(); });

// boot
(async () => {
  const me = await fetch("/api/admin/me").then(r => r.json()).catch(() => ({ admin: false, configured: false }));
  state.authed = me.admin; state.configured = me.configured;
  if (me.admin) try { localStorage.setItem("_bl_ignore", "1"); } catch {}
  render(); if (state.authed) loadAll();
})();
