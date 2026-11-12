// Store templates. Digital products (D1 + R2, sold through Stripe Checkout) sit next to the software in data/products.js.
import { html, esc } from "./layout.mjs";
import { sectionHead, productCard, contactForm, ctaBand } from "./components.mjs";
import { products } from "../data/products.js";

export const DOWNLOAD_LIMIT = 10;
export const STORE_DESCRIPTION = "Digital downloads, SocialSnap, the Agents at Work embed and the office worker character pack.";
export const priceLabel = (cents) => (!cents ? "Free" : "$" + (cents / 100).toFixed(cents % 100 ? 2 : 0));
export const coverUrl = (id, thumb = false) => `/media/products/${id}${thumb ? "-t" : ""}.jpg`;
export const sizeLabel = (b) => (!b ? "" : b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : b < 1e9 ? `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB` : `${(b / 1e9).toFixed(1)} GB`);
/** "Title: description" per line -> [[title, description]] */
export const featureList = (s) => String(s || "").split("\n").map(l => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean).map(l => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; });
const paragraphs = (s) => String(s || "").trim().split(/\n{2,}/).filter(Boolean).map(p => html`<p>${esc(p.trim()).replace(/\n/g, "<br />")}</p>`);
const fileExt = (name) => (/\.([a-z0-9]{1,8})$/i.exec(name || "")?.[1] || "").toUpperCase();

export const digitalCard = (p) => html`<a class="card card--link dcard" href="/store/${esc(p.id)}/">
  <div class="dcard__img">${p.cover ? html`<img src="${coverUrl(p.cover, true)}" alt="" loading="lazy" decoding="async" width="640" height="480" />` : html`<span>${esc((p.name || "?")[0])}</span>`}</div>
  <p class="eyebrow">${esc(p.kind || "Digital download")}</p>
  <h3>${esc(p.name)}</h3>
  <p class="muted">${esc(p.short)}</p>
  <p class="price"><b>${priceLabel(p.price)}</b><span>${p.price ? "instant download" : "for your email"}</span></p>
</a>`;

// ---------- /store/
export function storeIndexBody(digital = []) {
  const ids = new Set(digital.map(p => p.id)), software = products.filter(p => !ids.has(p.id)); // admin products override data/products.js by id
  return html`
<section class="wrap page__hero">
  ${digital.length ? sectionHead("Store", "Digital products and software.", "Download the moment you pay, or use the software we built for ourselves and now sell.")
    : sectionHead("Store", "Products you can buy today.", "Software we built for ourselves and now sell: a social media scheduler, the live agent office, and the characters inside it.")}
</section>
${digital.length ? html`<section class="wrap store__group"><p class="eyebrow" data-reveal>Digital downloads</p><div class="cards cards--3">${digital.map(digitalCard)}</div></section>` : ""}
${software.length ? html`<section class="wrap store__group">${digital.length ? html`<p class="eyebrow" data-reveal>Software and assets</p>` : ""}<div class="cards cards--3">${software.map(productCard)}</div></section>` : ""}
${ctaBand("Want a custom version of any of these?", "Talk to us")}`;
}

// ---------- /store/<id>/ for a digital product
const NOTICES = {
  error: "Checkout couldn't start. Try again in a minute, or contact us and we'll sort it out.",
  email: "Enter a valid email so we can send you the download link.",
  unavailable: "Online checkout isn't switched on yet. Use the form below and we'll send you a payment link.",
};

export function digitalBody(p, { checkout = true, notice = "", banner = "" } = {}) {
  const free = !p.price, canBuy = free || checkout;
  const feats = featureList(p.features), ext = fileExt(p.file_name);
  const buy = canBuy ? html`<form class="buy" method="post" action="/api/store/checkout" data-buy>
      <input type="hidden" name="product" value="${esc(p.id)}" />
      ${free ? html`<label>Email<input type="email" name="email" required autocomplete="email" placeholder="you@example.com" /></label>` : ""}
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn btn--buy" type="submit">${free ? "Email me the download" : `Buy for ${priceLabel(p.price)}`}</button>
    </form>` : html`<a class="btn btn--buy" href="#contact">Request ${esc(p.name)}</a>`;
  return html`${banner}
<section class="wrap page__hero product__hero product__hero--wide">
  <div>
    <p class="eyebrow" data-reveal><a href="/store/">Store</a> · ${esc(p.kind || "Digital download")}</p>
    <h1 data-reveal>${esc(p.name)}</h1>
    ${p.short ? html`<p class="lede" data-reveal>${esc(p.short)}</p>` : ""}
    ${p.cover ? html`<img class="product__cover" data-reveal src="${coverUrl(p.cover)}" alt="${esc(p.name)}" fetchpriority="high" />` : ""}
  </div>
  <aside class="pricebox" id="buy">
    ${Object.hasOwn(NOTICES, notice) ? html`<p class="notice">${NOTICES[notice]}</p>` : ""}
    <p class="price price--big"><b>${priceLabel(p.price)}</b><span>${free ? "free download" : "one-time"}</span></p>
    ${buy}
    <ul class="pricebox__list">
      <li>${free ? "We email you the download link" : "Instant download after payment"}</li>
      ${p.file_name ? html`<li>${esc(ext ? `${ext} file` : "File")}${p.file_size ? `, ${sizeLabel(p.file_size)}` : ""}</li>` : ""}
      <li>Up to ${DOWNLOAD_LIMIT} downloads per ${free ? "request" : "purchase"}</li>
      ${!free && canBuy ? html`<li>Secure checkout by Stripe</li>` : ""}
    </ul>
  </aside>
</section>
${p.body || feats.length ? html`<section class="wrap product__body">
  ${p.body ? html`<div class="prose" data-reveal>${paragraphs(p.body)}</div>` : ""}
  ${feats.length ? html`<div class="features">${feats.map(([t, d]) => html`<div data-reveal><b>${esc(t)}</b>${d ? html`<p>${esc(d)}</p>` : ""}</div>`)}</div>` : ""}
</section>` : ""}
<section class="contact" id="contact"><div class="wrap contact__grid">
  <div data-reveal><p class="eyebrow">Questions</p><h2>${canBuy ? "Need a different license or a custom version?" : `Request ${esc(p.name)}`}</h2><p class="lede">${canBuy ? "Team licenses, bulk pricing and custom builds on request." : "Tell us what you'll use it for and we'll send a payment link."}</p></div>
  ${contactForm({ interest: "Digital products", prompt: `Your question about ${p.name}`, options: false, simple: true })}
</div></section>`;
}

export const digitalHead = (p, origin) => ({
  title: `${p.name} · BardalesLabs Store`,
  description: p.short || `${p.name}, a digital download from BardalesLabs.`,
  image: p.cover ? origin + coverUrl(p.cover) : undefined,
  url: `${origin}/store/${p.id}/`,
  noindex: p.status !== "live",
  jsonld: { "@context": "https://schema.org", "@type": "Product", name: p.name, ...(p.short ? { description: p.short } : {}), ...(p.cover ? { image: origin + coverUrl(p.cover) } : {}), brand: { "@type": "Brand", name: "BardalesLabs" }, offers: { "@type": "Offer", price: (p.price / 100).toFixed(2), priceCurrency: "USD", availability: p.status === "live" ? "https://schema.org/InStock" : "https://schema.org/Discontinued", url: `${origin}/store/${p.id}/` } },
});

// ---------- /store/thanks/
export function thanksBody({ state, order, product }) {
  const name = product?.name || "your download";
  if (state === "ready") {
    const left = Math.max(0, DOWNLOAD_LIMIT - (order.downloads || 0));
    return html`<section class="wrap page__hero thanks">
  <p class="eyebrow">${order.amount ? "Order confirmed" : "Download ready"}</p>
  <h1>${order.amount ? "Thank you. Your download is ready." : "Your download is ready."}</h1>
  <p class="lede">${esc(name)}${product?.file_name ? html` · <span class="mono">${esc(product.file_name)}</span>` : ""}${product?.file_size ? ` (${sizeLabel(product.file_size)})` : ""}</p>
  <div class="actions">${left ? html`<a class="btn" href="/api/store/download/${esc(order.token)}" data-track="store_download">Download now</a>` : ""}<a class="btn btn--ghost" href="/store/">Back to the store</a></div>
  <p class="muted">${left ? `This link works ${left} more time${left === 1 ? "" : "s"}. Bookmark this page to download again later.` : "This link has been used the maximum number of times. Contact us and we'll send a fresh one."}${order.email && order.emailed ? ` We also emailed it to ${esc(order.email)}.` : ""}</p>
</section>`;
  }
  const msg = {
    pending: ["Payment received. Finishing up.", "Your payment is still being confirmed. Refresh this page in a minute; we'll also email you the download link."],
    refunded: ["This order was refunded.", "The download is no longer available. If that's a mistake, contact us."],
    missing: ["We couldn't find that order.", "Check the link in your receipt email. If you paid and still can't download, contact us and we'll fix it right away."],
  }[state] || ["Something went wrong.", "Contact us and we'll fix it right away."];
  return html`<section class="wrap page__hero thanks">
  <p class="eyebrow">Store</p>
  <h1>${msg[0]}</h1>
  <p class="lede">${msg[1]}</p>
  <div class="actions"><a class="btn" href="/contact/?interest=Digital%20products">Contact us</a><a class="btn btn--ghost" href="/store/">Back to the store</a></div>
</section>`;
}
