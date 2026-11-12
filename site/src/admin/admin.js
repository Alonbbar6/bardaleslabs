import "./admin.css";
import { work } from "../data/work.js";
import { apps } from "../data/apps.js";
import { products } from "../data/products.js";
import { company } from "../data/company.js";
import { MAKES, BODIES, AREAS, TRANSMISSIONS, FUELS, TITLES, SELLERS, CAR_STATUSES } from "../data/cars.js";
import { carTitle, money, milesLabel, photoUrl, agoLabel, miamiToday } from "../render/cars.mjs";
import { priceLabel, coverUrl, sizeLabel, DOWNLOAD_LIMIT } from "../render/store.mjs";
import { slugify } from "../api/util.js";
import { uploadPhoto, uploadFile } from "./upload.js";

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

const state = { authed: false, configured: true, tab: "overview", sub: "", days: 30, property: "", stats: null, items: [], downloads: null, inbox: [], settings: {}, gh: [], asc: null, cars: null, store: null, orders: [], loading: false, err: "" };
// "#cars/2016-toyota-camry-k3f9" -> tab "cars", sub "2016-toyota-camry-k3f9" (sub "new" = blank editor)
const route = () => { const [t, ...rest] = location.hash.slice(1).split("/"); state.tab = t || "overview"; state.sub = decodeURIComponent(rest.join("/")); };
route();
// the open car/product editor: working copy of photos/files, uploads in flight, unsaved-changes flag
const editor = { key: "", dirty: false, uploads: [], car: null, prod: null };
const errMsg = (e) => { const m = String(e?.message || e); try { return JSON.parse(m).error || m; } catch { return m; } };
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
  const tabs = [["overview", "Overview"], ["cars", "Cars"], ["store", "Store"], ["portfolio", "Portfolio"], ["analytics", "Analytics"], ["apps", "Apps & downloads"], ["inbox", `Inbox${state.inbox.filter(i => i.status === "new").length ? ` <em>${state.inbox.filter(i => i.status === "new").length}</em>` : ""}`], ["settings", "Settings"]];
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
    ${state.cars?.cars ? kpi("Cars listed", state.cars.cars.filter(c => c.status === "available" || c.status === "pending").length) : ""}
    ${state.store?.products ? kpi("Store revenue · 30 days", usd(state.orders.filter(o => o.status === "paid" && o.created_at >= Date.now() - 30 * 864e5).reduce((a, o) => a + (o.amount || 0), 0))) : ""}
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
    <tr><td>R2 bucket (MEDIA)</td><td><span class="pill pill--${state.settings.__media ? "live" : "paused"}">${state.settings.__media ? "bound" : "missing"}</span></td><td>Car photos, product covers and product files. Create with <code>npx wrangler r2 bucket create bardaleslabs-media</code>.</td></tr>
    <tr><td>STRIPE_SECRET_KEY</td><td><span class="pill pill--${state.settings.__stripe ? "live" : "paused"}">${state.settings.__stripe ? "set" : "missing"}</span></td><td>Store checkout. Without it, paid products show a request form instead of a Buy button.</td></tr>
    <tr><td>STRIPE_WEBHOOK_SECRET</td><td><span class="pill pill--${state.settings.__stripe_webhook ? "live" : "paused"}">${state.settings.__stripe_webhook ? "set" : "missing"}</span></td><td>Confirms payments even if the buyer closes the tab, and marks refunds. See Store for the endpoint URL.</td></tr>
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

// ---------- form bits
const usd = (cents) => "$" + ((cents || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const input = (name, value, attrs = "") => `<input name="${name}" value="${esc(value ?? "")}" ${attrs} />`;
const field = (name, label, value, attrs = "") => `<label>${label}${input(name, value, attrs)}</label>`;
const select = (name, label, opts, value) => `<label>${label}<select name="${name}"><option value="">—</option>${opts.map(o => `<option${o === value ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
const radios = (name, opts, value) => `<div class="seg seg--wrap">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}"${v === value ? " checked" : ""} /><span>${l}</span></label>`).join("")}</div>`;
const loadingCard = (title, err) => `<header class="head"><h1>${title}</h1></header><section class="card">${err ? `<p class="err">${esc(err)}</p>` : "<p class=\"muted\">Loading…</p>"}</section>`;
const daysOld = (d) => d ? (Date.parse(miamiToday()) - Date.parse(d)) / 864e5 : 0;

// ---------- cars
function carsView() {
  if (state.sub) return carEditorView();
  const cars = state.cars?.cars;
  if (!cars) return loadingCard("Cars", state.cars?.error);
  const n = (s) => cars.filter(c => c.status === s).length;
  return `<header class="head"><h1>Cars</h1><div class="bar"><a class="btn btn--ghost" href="/cars/" target="_blank">Directory ↗</a><a class="btn" href="#cars/new">+ New listing</a></div></header>
  ${state.cars.media === false ? `<p class="card warn">Photo storage isn't connected yet. Create the R2 bucket (<code>npx wrangler r2 bucket create bardaleslabs-media</code>) and deploy, then photos will upload.</p>` : ""}
  <div class="kpis">${kpi("Available", n("available"))}${kpi("Sale pending", n("pending"))}${kpi("Sold", n("sold"))}${kpi("Drafts", n("draft"))}</div>
  <section class="card">${cars.length ? `<div class="carlist">${cars.map(c => `<a class="carrow" href="#cars/${esc(c.id)}">
    <span class="carrow__img">${c.photos[0] ? `<img src="${photoUrl(c.photos[0], true)}" alt="" loading="lazy" />` : ""}</span>
    <span class="carrow__main"><b>${esc(carTitle(c))}</b><small>${[c.price != null ? money(c.price) : "no price", milesLabel(c.mileage), c.area, c.spotted ? `spotted ${agoLabel(c.spotted)}` : ""].filter(Boolean).map(esc).join(" · ")}</small>
    ${(c.status === "available" || c.status === "pending") && daysOld(c.spotted) > 30 ? `<small class="warn">Up for 30+ days. Still for sale?</small>` : ""}</span>
    <span class="pill pill--${c.status}">${c.status}</span></a>`).join("")}</div>`
    : `<p class="muted">No listings yet. Tap <b>+ New listing</b>, photograph the car and its for-sale sign, and type in what the sign says.</p>`}</section>`;
}

const photoTiles = () => editor.car.photos.map((id, i, all) => `<figure><img src="${photoUrl(id, true)}" alt="" />${i === 0 ? "<em>Cover</em>" : ""}
  <div class="ph__tools"><button type="button" data-ph-move="${i}:-1" aria-label="Move earlier"${i === 0 ? " disabled" : ""}>←</button><button type="button" data-ph-move="${i}:1" aria-label="Move later"${i === all.length - 1 ? " disabled" : ""}>→</button><button type="button" data-ph-del="${i}" aria-label="Remove photo">✕</button></div></figure>`).join("")
  + editor.uploads.map(u => `<figure class="is-up${u.error ? " is-err" : ""}" data-up="${u.key}">${u.preview ? `<img src="${u.preview}" alt="" />` : ""}<span>${u.error ? esc(u.error) : u.pct < 100 ? `${u.pct}%` : "Saving…"}</span>${u.error ? `<div class="ph__tools"><button type="button" data-up-dismiss="${u.key}" aria-label="Dismiss">✕</button></div>` : ""}</figure>`).join("");

function carEditorView() {
  const isNew = state.sub === "new";
  const c = isNew ? { status: "available", photos: [], spotted: miamiToday() } : state.cars?.cars?.find(x => x.id === state.sub);
  if (!c) return loadingCard("Car", state.cars?.cars ? "That listing doesn't exist anymore." : state.cars?.error);
  editor.car = { photos: [...c.photos] };
  return `<header class="head"><div><a class="link back" href="#cars">← All cars</a><h1>${isNew ? "New listing" : esc(carTitle(c))}</h1></div>
    ${isNew ? "" : `<div class="bar">${navigator.share ? `<button class="btn btn--ghost" data-share="/cars/${esc(c.id)}/">Share</button>` : ""}<a class="btn btn--ghost" href="/cars/${esc(c.id)}/" target="_blank">${c.status === "draft" ? "Preview" : "View"} ↗</a></div>`}</header>
  <form class="editor" data-car-form data-editor="cars/${esc(state.sub)}" autocomplete="off" novalidate>
    <section class="card"><h2>Photos <small>first one is the cover</small></h2>
      <div class="photos" data-photos>${photoTiles()}</div>
      <label class="btn photos__add"><input type="file" accept="image/*" multiple data-photo-input hidden />Add photos</label>
      <p class="muted small">Get the whole car, the sign, the interior and the odometer. Photos are shrunk on your phone before upload and their location data is removed.</p>
    </section>
    <section class="card"><h2>The car</h2>
      <div class="row3">${field("year", "Year", c.year, 'inputmode="numeric" maxlength="4" placeholder="2016"')}${field("make", "Make", c.make, 'list="dl-makes" placeholder="Toyota" autocapitalize="words"')}${field("model", "Model", c.model, 'placeholder="Camry" autocapitalize="words"')}</div>
      <div class="row">${field("trim", "Trim", c.trim, 'placeholder="SE"')}${field("color", "Color", c.color, 'placeholder="Silver" autocapitalize="words"')}</div>
      <div class="row">${field("price", "Price ($)", c.price ?? "", 'inputmode="numeric" placeholder="12500"')}${field("mileage", "Mileage", c.mileage ?? "", 'inputmode="numeric" placeholder="84000 or 84k"')}</div>
      <div class="row">${select("body", "Body", BODIES, c.body)}${select("transmission", "Transmission", TRANSMISSIONS, c.transmission)}</div>
      <div class="row">${select("fuel", "Fuel", FUELS, c.fuel)}${select("title_status", "Title", TITLES, c.title_status)}</div>
      <label>VIN <span class="muted">(dashboard, through the windshield)</span><span class="inline">${input("vin", c.vin, 'maxlength="17" autocapitalize="characters" spellcheck="false" placeholder="17 characters"')}<button type="button" class="btn btn--ghost" data-vin>Decode</button></span></label>
      <p class="muted small" data-vin-status></p>
    </section>
    <section class="card"><h2>Seller and where you saw it</h2>
      <div class="row">${field("phone", "Phone on the sign", c.phone, 'type="tel" inputmode="tel" placeholder="(305) 555-1234"')}${select("seller", "Seller", SELLERS, c.seller)}</div>
      <div class="row">${field("area", "Area", c.area, 'list="dl-areas" placeholder="Hialeah" autocapitalize="words"')}${field("spotted", "Spotted on", c.spotted, 'type="date"')}</div>
      <label>Description<textarea name="description" rows="5" placeholder="What the sign says, condition, anything a buyer should know">${esc(c.description)}</textarea></label>
    </section>
    <section class="card"><h2>Status</h2>${radios("status", CAR_STATUSES, c.status)}</section>
    <div class="savebar">${isNew ? "" : `<button type="button" class="link danger" data-car-delete>Delete</button>`}<span class="savebar__msg" data-save-msg></span><button class="btn" type="submit">${isNew ? "Save listing" : "Save changes"}</button></div>
  </form>
  <datalist id="dl-makes">${MAKES.map(m => `<option value="${esc(m)}">`).join("")}</datalist>
  <datalist id="dl-areas">${AREAS.map(m => `<option value="${esc(m)}">`).join("")}</datalist>`;
}

// ---------- store
function storeSetup(s) {
  const hook = `${location.origin}/api/store/webhook`;
  const rows = [
    [s.media, "File storage", "R2 bucket for covers and files: <code>npx wrangler r2 bucket create bardaleslabs-media</code>, then deploy."],
    [s.stripe, "Stripe checkout", "Stripe → Developers → API keys. Copy the secret key, then <code>npx wrangler secret put STRIPE_SECRET_KEY</code>."],
    [s.webhook, "Payment webhook", `Stripe → Developers → Webhooks → add <code>${esc(hook)}</code> with <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> and <code>charge.refunded</code>. Copy its signing secret: <code>npx wrangler secret put STRIPE_WEBHOOK_SECRET</code>.`],
    [s.email, "Receipt emails", "<code>RESEND_API_KEY</code>, the same key the contact form uses. Without it buyers still get the link on the thank-you page."],
  ];
  if (rows.every(([ok]) => ok)) return "";
  return `<section class="card"><h2>Finish setting up selling</h2><ul class="setup">${rows.map(([ok, t, d]) => `<li class="${ok ? "is-ok" : ""}"><b>${ok ? "✓" : "○"} ${t}</b>${ok ? "" : `<small>${d}</small>`}</li>`).join("")}</ul><p class="muted small">Free products work as soon as storage is set up.</p></section>`;
}

function storeView() {
  if (state.sub) return productEditorView();
  const s = state.store;
  if (!s?.products) return loadingCard("Store", s?.error);
  const sales = Object.fromEntries(s.sales.map(r => [r.product_id, r])), since = Date.now() - 30 * 864e5;
  const recent = state.orders.filter(o => o.status === "paid" && o.created_at >= since);
  return `<header class="head"><h1>Store</h1><div class="bar"><a class="btn btn--ghost" href="/store/" target="_blank">Store ↗</a><a class="btn" href="#store/new">+ New product</a></div></header>
  ${storeSetup(s)}
  <div class="kpis">${kpi("Revenue · 30 days", usd(recent.reduce((a, o) => a + (o.amount || 0), 0)))}${kpi("Sales · 30 days", recent.filter(o => o.amount).length)}${kpi("Free downloads · 30 days", recent.filter(o => !o.amount).length)}${kpi("Live products", s.products.filter(p => p.status === "live").length)}</div>
  <section class="card"><h2>Digital products <small>${s.products.length}</small></h2>${s.products.length ? `<table class="tbl"><thead><tr><th>Product</th><th>Price</th><th>Status</th><th>Sales</th><th></th></tr></thead><tbody>
    ${s.products.map(p => `<tr><td><span class="prodcell">${p.cover ? `<img src="${coverUrl(p.cover, true)}" alt="" />` : "<i></i>"}<span><b>${esc(p.name)}</b><small>/store/${esc(p.id)}/${p.file_name ? ` · ${esc(p.file_name)}` : " · no file yet"}</small></span></span></td>
      <td>${priceLabel(p.price)}</td><td><span class="pill pill--${p.status}">${p.status}</span></td><td>${sales[p.id] ? `${sales[p.id].orders}${sales[p.id].revenue ? ` · ${usd(sales[p.id].revenue)}` : ""}` : "—"}</td><td><a class="link" href="#store/${esc(p.id)}">Edit</a></td></tr>`).join("")}</tbody></table>`
    : `<p class="muted">Sell templates, e-books, presets, code, courses: anything that downloads. Add one with <b>+ New product</b>. The software in <code>src/data/products.js</code> still shows in the store too.</p>`}</section>
  <section class="card"><h2>Orders <small>${state.orders.length}</small></h2>${state.orders.length ? `<table class="tbl"><thead><tr><th>When</th><th>Product</th><th>Buyer</th><th>Amount</th><th>Downloads</th><th></th></tr></thead><tbody>
    ${state.orders.map(o => `<tr class="${o.status === "refunded" ? "st-archived" : ""}"><td><small>${ago(o.created_at)}</small></td><td>${esc(o.product_name || o.product_id)}</td><td>${o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : "—"}</td>
      <td>${o.amount ? usd(o.amount) : "free"}${o.status === "refunded" ? ` <span class="pill pill--paused">refunded</span>` : ""}</td><td>${o.downloads}/${DOWNLOAD_LIMIT}</td><td><button class="link" data-copy="${esc(`${location.origin}/store/thanks/?order=${o.token}`)}">Copy link</button></td></tr>`).join("")}</tbody></table>`
    : `<p class="muted">No orders yet. Each sale and free download lands here with the buyer's email.</p>`}</section>`;
}

const coverTile = () => editor.prod.coverUp ? `<figure class="is-up">${editor.prod.coverUp.preview ? `<img src="${editor.prod.coverUp.preview}" alt="" />` : ""}<span>${esc(editor.prod.coverUp.error || `${editor.prod.coverUp.pct}%`)}</span></figure>`
  : editor.prod.cover ? `<figure><img src="${coverUrl(editor.prod.cover, true)}" alt="" /><div class="ph__tools"><button type="button" data-cover-del aria-label="Remove cover">✕</button></div></figure>` : `<p class="muted small">No cover yet. 4:3 works best.</p>`;
const fileTile = () => { const f = editor.prod.file, u = editor.prod.fileUp;
  if (u) return `<div class="filebox"><b>${esc(u.name)}</b><div class="meter"><i style="width:${u.pct}%"></i></div><small class="${u.error ? "err" : "muted"}">${u.error ? esc(u.error) : `${u.pct}% · keep this tab open`}</small></div>`;
  return f ? `<div class="filebox"><b>${esc(f.name)}</b><small class="muted">${sizeLabel(f.size)}${f.type ? ` · ${esc(f.type)}` : ""}</small></div>` : `<p class="muted small">No file yet. This is what buyers download.</p>`; };

function productEditorView() {
  const isNew = state.sub === "new";
  const p = isNew ? { status: "draft", price: 0, sort: 0 } : state.store?.products?.find(x => x.id === state.sub);
  if (!p) return loadingCard("Product", state.store?.products ? "That product doesn't exist anymore." : state.store?.error);
  editor.prod = { cover: p.cover || null, file: p.file_key ? { key: p.file_key, name: p.file_name, size: p.file_size, type: p.file_type } : null, coverUp: null, fileUp: null, slugTouched: !isNew };
  return `<header class="head"><div><a class="link back" href="#store">← Store</a><h1>${isNew ? "New product" : esc(p.name)}</h1></div>${isNew ? "" : `<a class="btn btn--ghost" href="/store/${esc(p.id)}/" target="_blank">${p.status === "live" ? "View" : "Preview"} ↗</a>`}</header>
  <form class="editor" data-prod-form data-editor="store/${esc(state.sub)}" autocomplete="off" novalidate>
    <section class="card"><h2>Product</h2>
      ${field("name", "Name", p.name, 'placeholder="Miami real estate post templates"')}
      <label>Web address<span class="inline"><span class="muted">/store/</span>${input("id", isNew ? "" : p.id, `placeholder="real-estate-templates" spellcheck="false" autocapitalize="none" ${isNew ? "data-slug" : "readonly"}`)}</span></label>
      <div class="row">${field("kind", "Type", p.kind, 'placeholder="Template pack, e-book, preset…"')}${field("price", "Price in USD (0 = free)", p.price ? (p.price / 100).toFixed(2).replace(/\.00$/, "") : "0", 'inputmode="decimal"')}</div>
      ${field("short", "One-line pitch", p.short, 'maxlength="300" placeholder="Shown on the store card and in Google"')}
      <label>Description<textarea name="body" rows="7" placeholder="Who it's for, what it does, why it's worth it. Blank line = new paragraph.">${esc(p.body)}</textarea></label>
      <label>What's included <span class="muted">(one per line, "Title: detail")</span><textarea name="features" rows="5" placeholder="30 Canva templates: posts, stories and reel covers&#10;Lifetime updates: new versions are free">${esc(p.features)}</textarea></label>
    </section>
    <section class="card"><h2>Cover image</h2><div class="photos photos--one" data-cover>${coverTile()}</div><label class="btn btn--ghost photos__add"><input type="file" accept="image/*" data-cover-input hidden />Choose image</label></section>
    <section class="card"><h2>File buyers get</h2><div data-file>${fileTile()}</div><label class="btn btn--ghost photos__add"><input type="file" data-file-input hidden />${p.file_key ? "Replace file" : "Upload file"}</label><p class="muted small">Any format and size: ZIP, PDF, video. Replacing it gives past buyers the new version.</p></section>
    <section class="card"><h2>Status</h2>${radios("status", [["draft", "Draft (hidden)"], ["live", "Live in the store"], ["archived", "Archived"]], p.status)}
      <label class="narrow">Sort order <span class="muted">(lower shows first)</span>${input("sort", p.sort ?? 0, 'inputmode="numeric"')}</label></section>
    <div class="savebar">${isNew ? "" : `<button type="button" class="link danger" data-prod-delete>Delete</button>`}<span class="savebar__msg" data-save-msg></span><button class="btn" type="submit">${isNew ? "Create product" : "Save changes"}</button></div>
  </form>`;
}

// ---------- render + data
function render(force = false) {
  if (!state.authed) { root.innerHTML = loginView(); return; }
  // background refreshes must not wipe a half-filled car/product form
  if (!force && state.sub && root.querySelector("[data-editor]")?.dataset.editor === `${state.tab}/${state.sub}`) return;
  const view = { overview, cars: carsView, store: storeView, analytics, portfolio, apps: appsView, inbox: inboxView, settings: settingsView }[state.tab] || overview;
  Object.assign(editor, { key: state.sub ? `${state.tab}/${state.sub}` : "", dirty: false, uploads: [], car: null, prod: null });
  root.innerHTML = shell(view());
  const c = $("[data-chart]"); if (c && state.stats) lineChart(c, state.stats.series);
  $$("[data-dl]").forEach(cv => { const rows = (state.downloads?.rows || []).filter(r => r.app_id === cv.dataset.dl); const map = Object.fromEntries(rows.map(r => [r.day, r.units])); const series = []; for (let i = 89; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); series.push({ d, views: map[d] || 0 }); } lineChart(cv, series, ["views"]); });
}

async function loadAll() {
  state.loading = true;
  try {
    const soft = (p) => api(p).catch(e => { if (e.message === "unauthorized") throw e; return { error: errMsg(e) }; });
    const [stats, dbItems, downloads, inbox, settings, asc, cars, store, orders] = await Promise.all([api(`stats?days=${state.days}&property=${encodeURIComponent(state.property)}`), api("items"), api("downloads?days=90"), api("inbox"), api("settings"), api("appstore"), soft("cars"), soft("products"), soft("orders")]);
    Object.assign(state, { cars, store, orders: Array.isArray(orders) ? orders : [] });
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

// ---------- car + product editors
const setMsg = (msg, cls = "muted") => { const m = root.querySelector("[data-save-msg]"); if (m) { m.textContent = msg; m.className = `savebar__msg ${cls}`; } };
const dirty = () => { editor.dirty = true; setMsg("Unsaved changes"); };
const busy = () => editor.uploads.some(u => !u.error) || !!(editor.prod?.coverUp && !editor.prod.coverUp.error) || !!(editor.prod?.fileUp && !editor.prod.fileUp.error);
const signedOut = () => { state.authed = false; render(true); };
const paint = (sel, fn) => { const el = root.querySelector(sel); if (el) el.innerHTML = fn(); };
const paintPhotos = () => paint("[data-photos]", photoTiles), paintCover = () => paint("[data-cover]", coverTile), paintFile = () => paint("[data-file]", fileTile);
const upPct = (u) => { const el = root.querySelector(`[data-up="${u.key}"] span`); if (el) el.textContent = u.pct < 100 ? `${u.pct}%` : "Saving…"; };

async function addPhotos(files) {
  const session = editor.car;
  for (const file of files) {
    if (editor.car !== session) return; // moved to another listing
    const u = { key: Math.random().toString(36).slice(2), pct: 0, preview: "" };
    editor.uploads.push(u); paintPhotos();
    try {
      const id = await uploadPhoto(file, "cars", { onPreview: (url) => { u.preview = url; paintPhotos(); }, onProgress: (p) => { u.pct = Math.round(p * 100); upPct(u); } });
      if (editor.car !== session) return;
      editor.uploads = editor.uploads.filter(x => x !== u); URL.revokeObjectURL(u.preview);
      session.photos.push(id); dirty();
    } catch (err) { if (err.status === 401) return signedOut(); u.error = errMsg(err); }
    paintPhotos();
  }
}

async function setCover(file) {
  const session = editor.prod; if (!file || !session) return;
  session.coverUp = { pct: 0, preview: "" }; paintCover();
  try {
    session.cover = await uploadPhoto(file, "products", { onPreview: (url) => { session.coverUp.preview = url; paintCover(); }, onProgress: (p) => { session.coverUp.pct = Math.round(p * 100); paintCover(); } });
    session.coverUp = null; dirty();
  } catch (err) { if (err.status === 401) return signedOut(); session.coverUp.error = errMsg(err); setTimeout(() => { if (session.coverUp?.error) { session.coverUp = null; if (editor.prod === session) paintCover(); } }, 5000); }
  if (editor.prod === session) paintCover();
}

async function setFile(file) {
  const session = editor.prod; if (!file || !session) return;
  session.fileUp = { name: file.name, pct: 0 }; paintFile();
  try {
    session.file = await uploadFile(file, (p) => { session.fileUp.pct = Math.min(99, Math.round(p * 100)); if (editor.prod === session) paintFile(); });
    session.fileUp = null; editor.dirty = true; setMsg("File uploaded. Save to attach it.", "ok");
  } catch (err) { if (err.status === 401) return signedOut(); session.fileUp.error = errMsg(err); }
  if (editor.prod === session) paintFile();
}

async function saveCar(f) {
  if (busy()) return setMsg("Wait for the photos to finish uploading.", "warn");
  const isNew = state.sub === "new", btn = f.querySelector("[type=submit]");
  setMsg("Saving…"); btn.disabled = true;
  try {
    const { car } = await api("cars", { method: "POST", body: { ...Object.fromEntries(new FormData(f)), id: isNew ? undefined : state.sub, photos: editor.car.photos } });
    if (!state.cars?.cars) state.cars = { ...state.cars, cars: [] };
    const list = state.cars.cars, i = list.findIndex(c => c.id === car.id); if (i >= 0) list[i] = car; else list.unshift(car);
    if (isNew) history.replaceState(null, "", `#cars/${car.id}`);
    state.sub = car.id; render(true);
    setMsg(car.status === "draft" ? "Saved as a draft (hidden from the public)." : car.status === "sold" ? "Saved. Marked as sold." : "Saved. It's live in the directory.", "ok");
  } catch (err) { if (err.message === "unauthorized") return; setMsg(errMsg(err), "err"); btn.disabled = false; }
}

async function saveProduct(f) {
  if (busy()) return setMsg("Wait for the upload to finish.", "warn");
  const d = Object.fromEntries(new FormData(f)), isNew = state.sub === "new", btn = f.querySelector("[type=submit]"), file = editor.prod.file;
  if (!d.name?.trim()) return setMsg("Give the product a name.", "err");
  if (isNew && !/^[a-z0-9][a-z0-9-]{1,59}$/.test(d.id || "")) return setMsg("Web address: lowercase letters, numbers and dashes.", "err");
  setMsg("Saving…"); btn.disabled = true;
  try {
    const { product } = await api("products", { method: "POST", body: { ...d, create: isNew, price: Math.round(parseFloat(String(d.price).replace(/[$,\s]/g, "")) * 100) || 0, cover: editor.prod.cover,
      file_key: file?.key || null, file_name: file?.name || null, file_size: file?.size || null, file_type: file?.type || null } });
    if (!state.store?.products) state.store = { ...state.store, products: [], sales: [] };
    const list = state.store.products, i = list.findIndex(p => p.id === product.id); if (i >= 0) list[i] = product; else list.unshift(product);
    if (isNew) history.replaceState(null, "", `#store/${product.id}`);
    state.sub = product.id; render(true);
    setMsg(product.status === "live" ? "Saved. It's live in the store." : product.status === "draft" ? "Saved as a draft. Preview it before going live." : "Saved. Archived: hidden, past buyers can still download.", "ok");
  } catch (err) { if (err.message === "unauthorized") return; setMsg(errMsg(err), "err"); btn.disabled = false; }
}

async function decodeVin(btn) {
  const f = btn.closest("form"), status = f.querySelector("[data-vin-status]"), el = (k) => f.elements.namedItem(k);
  status.className = "muted small"; status.textContent = "Looking up the VIN…"; btn.disabled = true;
  try {
    const r = await api(`vin?vin=${encodeURIComponent(el("vin").value)}`);
    if (r.error) throw new Error(r.error);
    for (const k of ["year", "make", "model", "trim", "body", "fuel", "transmission"]) if (r[k]) el(k).value = r[k];
    dirty(); status.className = "ok small"; status.textContent = `Filled in from NHTSA: ${[r.year, r.make, r.model, r.trim].filter(Boolean).join(" ")}. Check it against the sign.`;
  } catch (err) { status.className = "err small"; status.textContent = errMsg(err); }
  btn.disabled = false;
}

// ---------- events
root.addEventListener("input", (e) => {
  const f = e.target.closest("[data-editor]"); if (!f) return;
  dirty();
  if (f.matches("[data-prod-form]")) {
    if (e.target.name === "id") editor.prod.slugTouched = true;
    if (e.target.name === "name" && !editor.prod.slugTouched && f.elements.namedItem("id")?.hasAttribute("data-slug")) f.elements.namedItem("id").value = slugify(e.target.value);
  }
});
root.addEventListener("submit", async (e) => {
  const f = e.target; e.preventDefault();
  if (f.matches("[data-login]")) { try { state.err = ""; await api("login", { method: "POST", body: { password: new FormData(f).get("password") } }); state.authed = true; try { localStorage.setItem("_bl_ignore", "1"); } catch {} await loadAll(); } catch (err) { state.err = err.message.includes("401") || /wrong/.test(err.message) ? "Wrong password" : err.message; render(); } }
  else if (f.matches("[data-item-form]")) { const d = Object.fromEntries(new FormData(f)); await api("items", { method: "POST", body: d }); $("[data-dialog]").close(); await loadAll(); }
  else if (f.matches("[data-car-form]")) await saveCar(f);
  else if (f.matches("[data-prod-form]")) await saveProduct(f);
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
  else if (t.matches("[data-ph-move]")) { const [i, d] = t.dataset.phMove.split(":").map(Number), a = editor.car.photos; [a[i], a[i + d]] = [a[i + d], a[i]]; dirty(); paintPhotos(); }
  else if (t.matches("[data-ph-del]")) { editor.car.photos.splice(+t.dataset.phDel, 1); dirty(); paintPhotos(); }
  else if (t.matches("[data-up-dismiss]")) { editor.uploads = editor.uploads.filter(u => u.key !== t.dataset.upDismiss); paintPhotos(); }
  else if (t.matches("[data-cover-del]")) { editor.prod.cover = null; dirty(); paintCover(); }
  else if (t.matches("[data-vin]")) await decodeVin(t);
  else if (t.matches("[data-share]")) navigator.share({ url: location.origin + t.dataset.share }).catch(() => {});
  else if (t.matches("[data-copy]")) { await navigator.clipboard?.writeText(t.dataset.copy).catch(() => prompt("Copy this link:", t.dataset.copy)); t.textContent = "Copied"; setTimeout(() => { t.textContent = "Copy link"; }, 1500); }
  else if (t.matches("[data-car-delete]")) {
    if (!confirm("Delete this listing and its photos? This can't be undone. (To keep it but hide it, mark it Sold or Draft.)")) return;
    try { await api("cars", { method: "DELETE", body: { id: state.sub } }); state.cars.cars = state.cars.cars.filter(c => c.id !== state.sub); editor.dirty = false; location.hash = "#cars"; } catch (err) { setMsg(errMsg(err), "err"); }
  }
  else if (t.matches("[data-prod-delete]")) {
    if (!confirm("Delete this product, its cover and its file? This can't be undone.")) return;
    try { await api("products", { method: "DELETE", body: { id: state.sub } }); state.store.products = state.store.products.filter(p => p.id !== state.sub); editor.dirty = false; location.hash = "#store"; } catch (err) { setMsg(errMsg(err), "err"); }
  }
  else if (t.matches("[data-asc-pull]")) { t.disabled = true; const r = await api("appstore", { method: "POST" }); alert(JSON.stringify(r, null, 2)); await loadAll(); }
});
root.addEventListener("change", async (e) => {
  if (e.target.matches("[data-photo-input]")) { const files = [...e.target.files]; e.target.value = ""; return addPhotos(files); }
  if (e.target.matches("[data-cover-input]")) { const file = e.target.files[0]; e.target.value = ""; return setCover(file); }
  if (e.target.matches("[data-file-input]")) { const file = e.target.files[0]; e.target.value = ""; return setFile(file); }
  if (e.target.matches("[data-exclude-list]")) { await api("settings", { method: "POST", body: { exclude_ips: e.target.value } }); await loadAll(); }
  if (e.target.matches("[data-property]")) { state.property = e.target.value; await loadStats(); }
  if (e.target.matches("[data-inbox]")) { await api("inbox", { method: "POST", body: { id: +e.target.dataset.inbox, status: e.target.value } }); const m = state.inbox.find(i => i.id === +e.target.dataset.inbox); if (m) m.status = e.target.value; render(); }
});
function openItem(item) { const f = $("[data-item-form]"); for (const [k, v] of Object.entries(item)) if (f.elements[k]) f.elements[k].value = v ?? ""; f.elements.id.readOnly = !!item.id; $("[data-dialog]").showModal(); }
addEventListener("hashchange", () => {
  if (editor.key && `#${editor.key}` !== location.hash && (editor.dirty || busy()) && !confirm(busy() ? "An upload is still running. Leave and cancel it?" : "You have unsaved changes. Leave without saving?")) {
    history.replaceState(null, "", `#${editor.key}`); return;
  }
  route(); render(true);
});
addEventListener("beforeunload", (e) => { if (editor.key && (editor.dirty || busy())) { e.preventDefault(); e.returnValue = ""; } });

// boot
(async () => {
  const me = await fetch("/api/admin/me").then(r => r.json()).catch(() => ({ admin: false, configured: false }));
  state.authed = me.admin; state.configured = me.configured;
  if (me.admin) try { localStorage.setItem("_bl_ignore", "1"); } catch {}
  render(); if (state.authed) loadAll();
})();
