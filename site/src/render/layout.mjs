import { company } from "../data/company.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const html = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join("") : vals[i] ?? "") : ""), "");

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%233f7bd9'/%3E%3Cpath d='M9 23V9h7a4 4 0 0 1 2.2 7.3A4 4 0 0 1 17 23z' fill='%23fff'/%3E%3C/svg%3E";

export function nav(active) {
  return html`<header class="nav" data-nav>
  <a class="brand" href="/">Bardales<span>Labs</span></a>
  <button class="nav__toggle" data-nav-toggle aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
  <nav class="nav__links" data-nav-links>
    ${company.nav.map(n => html`<a href="${n.href}"${active === n.href ? ' aria-current="page"' : ""}>${n.label}</a>`)}
    <a href="${company.cta.href}" class="btn btn--sm">${company.cta.label}</a>
  </nav>
</header>`;
}

export function footer() {
  const f = company.founder;
  return html`<footer class="foot wrap">
  <div>
    <a class="brand" href="/">Bardales<span>Labs</span></a>
    <p class="muted">${esc(company.tagline)} Run by ${esc(f.name)}, ${esc(f.location)}.</p>
  </div>
  <nav class="foot__links">
    ${company.nav.map(n => html`<a href="${n.href}">${n.label}</a>`)}
    <a href="/contact/">Contact</a>
    <a href="${company.agentsUrl}" data-agents-link>Agents at work</a>
    <a href="mailto:${f.email}">${f.email}</a>
  </nav>
  <p class="muted small">© <span data-year></span> BardalesLabs. Outreach is always sent with our name and the client we represent.</p>
</footer>`;
}

/** Full document. */
export function page({ title, description, body, active = "", pageId, image = "/office-poster.jpg" }) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${company.domain}${image}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="${ICON}" />
</head>
<body data-page="${pageId}">
<a class="skip" href="#main">Skip to content</a>
${nav(active)}
<main id="main">
${body}
</main>
${footer()}
<script type="module" src="/src/main.js"></script>
</body>
</html>`;
}
