// Miami-Dade car directory templates. Rendered by the Worker per request (listings come from D1).
import { html, esc } from "./layout.mjs";
import { contactForm } from "./components.mjs";
import { carsCopy, PRICE_CAPS, CAR_SORTS } from "../data/cars.js";

// ---------- formatting (shared with the admin)
export const carTitle = (c) => [c.year, c.make, c.model, c.trim].filter(Boolean).join(" ") || "Car for sale";
export const money = (n) => (n == null || n === "" ? "" : "$" + Number(n).toLocaleString("en-US"));
export const milesLabel = (n) => (n == null || n === "" ? "" : `${Number(n).toLocaleString("en-US")} mi`);
export const photoUrl = (id, thumb = false) => `/media/cars/${id}${thumb ? "-t" : ""}.jpg`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ""; };
/** Today's date in Miami, YYYY-MM-DD. */
export const miamiToday = (now = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
export function agoLabel(d, now = Date.now()) {
  const t = Date.parse(`${d}T00:00:00Z`), today = Date.parse(`${miamiToday(now)}T00:00:00Z`);
  if (!t) return "";
  const days = Math.max(0, Math.round((today - t) / 864e5));
  return days === 0 ? "today" : days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.floor(days / 7)} weeks ago` : `${Math.floor(days / 30)} months ago`;
}
/** +13055551234 from whatever was written on the sign; "" when there's no usable number. */
export function telHref(p) {
  const d = String(p || "").replace(/[^\d+]/g, ""), digits = d.replace(/\D/g, "");
  if (digits.length < 7) return "";
  if (d.startsWith("+")) return "+" + digits;
  return digits.length === 10 ? "+1" + digits : digits.length === 11 && digits[0] === "1" ? "+" + digits : digits;
}
export function phoneLabel(p) {
  const d = String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || "");
}
const paragraphs = (s) => String(s || "").trim().split(/\n{2,}/).filter(Boolean).map(p => html`<p>${esc(p.trim()).replace(/\n/g, "<br />")}</p>`);
const badge = (status) => status === "pending" ? html`<span class="badge badge--pending">Sale pending</span>` : status === "sold" ? html`<span class="badge badge--sold">Sold</span>` : status === "draft" ? html`<span class="badge">Draft</span>` : "";

// ---------- cards
export const carCard = (c) => html`<a class="carcard" href="/cars/${esc(c.id)}/">
  <div class="carcard__img">${c.photos[0] ? html`<img src="${photoUrl(c.photos[0], true)}" alt="${esc(carTitle(c))}" loading="lazy" decoding="async" width="640" height="480" />` : html`<span class="carcard__nophoto">No photo yet</span>`}${badge(c.status)}${c.photos.length > 1 ? html`<span class="carcard__n">${c.photos.length} photos</span>` : ""}</div>
  <div class="carcard__body">
    <p class="carcard__price">${c.price != null ? money(c.price) : "Ask for price"}</p>
    <h3>${esc(carTitle(c))}</h3>
    <p class="carcard__meta">${[milesLabel(c.mileage), c.area].filter(Boolean).map(esc).join(" · ")}</p>
    ${c.spotted ? html`<p class="carcard__when">Spotted ${esc(agoLabel(c.spotted))}</p>` : ""}
  </div>
</a>`;

// ---------- directory: /cars/
export const CAR_FILTER_KEYS = ["q", "make", "body", "area", "max", "sort"];
export function carsQuery(f, over = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...over })) if (v && !(k === "sort" && v === "new") && !(k === "page" && +v <= 1)) u.set(k, v);
  const s = u.toString();
  return `/cars/${s ? `?${s}` : ""}`;
}

export function carsIndexBody({ cars, total, page, pages, facets, f, notice = "" }) {
  const opt = (v, label, cur) => html`<option value="${esc(v)}"${String(cur ?? "") === String(v) ? " selected" : ""}>${esc(label)}</option>`;
  const facet = (list, cur) => list.concat(cur && !list.some(([v]) => v === cur) ? [[cur, 0]] : []);
  const filtered = ["q", "make", "body", "area", "max"].some(k => f[k]);
  return html`
<section class="wrap page__hero cars__hero">
  <p class="eyebrow" data-reveal>${esc(carsCopy.eyebrow)}</p>
  <h1 data-reveal>${esc(carsCopy.title)}</h1>
  <p class="lede" data-reveal>${esc(carsCopy.lede)}</p>
</section>
<section class="wrap cars">
  ${notice}
  <form class="carfilter" method="get" action="/cars/" role="search" data-carfilter>
    <label class="carfilter__q"><span class="sr">Search</span><input type="search" name="q" value="${esc(f.q)}" placeholder="Search make, model, year or color" enterkeyhint="search" /></label>
    <button class="btn" type="submit">Search</button>
    <div class="carfilter__opts">
    <label><span class="sr">Make</span><select name="make">${opt("", "Any make", f.make)}${facet(facets.makes, f.make).map(([m, n]) => opt(m, n ? `${m} (${n})` : m, f.make))}</select></label>
    <label><span class="sr">Body type</span><select name="body">${opt("", "Any body type", f.body)}${facet(facets.bodies, f.body).map(([m, n]) => opt(m, n ? `${m} (${n})` : m, f.body))}</select></label>
    <label><span class="sr">Area</span><select name="area">${opt("", "All of Miami-Dade", f.area)}${facet(facets.areas, f.area).map(([m, n]) => opt(m, n ? `${m} (${n})` : m, f.area))}</select></label>
    <label><span class="sr">Max price</span><select name="max">${opt("", "Any price", f.max)}${PRICE_CAPS.map(p => opt(p, `Under ${money(p)}`, f.max))}</select></label>
    <label><span class="sr">Sort</span><select name="sort">${CAR_SORTS.map(([v, l]) => opt(v, l, f.sort))}</select></label>
    </div>
  </form>
  <p class="cars__count">${total === 1 ? "1 car" : `${total.toLocaleString("en-US")} cars`}${filtered ? html` match · <a href="/cars/">Clear filters</a>` : facets.total ? " for sale right now" : ""}</p>
  ${cars.length ? html`<div class="cars__grid">${cars.map(carCard)}</div>` : html`<div class="cars__empty">
    <h2>${filtered ? "No cars match those filters." : "New listings are on the way."}</h2>
    <p class="muted">${filtered ? "Try a higher price, another area, or clear the filters." : "We add cars as we spot them around the county. Check back soon."}</p>
    ${filtered ? html`<a class="btn btn--ghost" href="/cars/">See all cars</a>` : ""}
  </div>`}
  ${pages > 1 ? html`<nav class="pager" aria-label="Pages">
    ${page > 1 ? html`<a class="btn btn--ghost" href="${esc(carsQuery(f, { page: page - 1 }))}" rel="prev">← Newer</a>` : html`<span></span>`}
    <span class="muted">Page ${page} of ${pages}</span>
    ${page < pages ? html`<a class="btn btn--ghost" href="${esc(carsQuery(f, { page: page + 1 }))}" rel="next">More cars →</a>` : html`<span></span>`}
  </nav>` : ""}
</section>
<section class="wrap block cars__how">
  <div class="features">${carsCopy.steps.map(([t, d], i) => html`<div data-reveal><b>0${i + 1} · ${esc(t)}</b><p>${esc(d)}</p></div>`)}</div>
  <div class="band cars__sell" data-reveal>
    <div><h2>${esc(carsCopy.sellTitle)}</h2><p class="muted">${esc(carsCopy.sellBody)}</p></div>
    <a class="btn" href="/contact/?interest=Car%20directory">List your car</a>
  </div>
  <p class="muted small">${esc(carsCopy.disclaimer)}</p>
</section>`;
}

// ---------- detail: /cars/<id>/
const gallery = (c) => {
  const t = carTitle(c), n = c.photos.length;
  if (!n) return html`<div class="gallery gallery--empty"><span>No photos yet</span></div>`;
  return html`<div class="gallery" data-gallery>
    <div class="gallery__track" data-gallery-track data-lenis-prevent tabindex="0" aria-label="Photos of the ${esc(t)}">
      ${c.photos.map((id, i) => html`<figure><img src="${photoUrl(id)}" alt="${esc(t)}, photo ${i + 1} of ${n}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" /></figure>`)}
    </div>
    ${n > 1 ? html`<button class="gallery__nav gallery__nav--prev" type="button" data-gallery-prev aria-label="Previous photo">‹</button><button class="gallery__nav gallery__nav--next" type="button" data-gallery-next aria-label="Next photo">›</button><span class="gallery__count" data-gallery-count>1 / ${n}</span>` : ""}
  </div>
  ${n > 1 ? html`<div class="gallery__thumbs">${c.photos.map((id, i) => html`<button type="button" data-gallery-go="${i}"${i ? "" : ' class="is-on"'} aria-label="Show photo ${i + 1}"><img src="${photoUrl(id, true)}" alt="" loading="lazy" /></button>`)}</div>` : ""}`;
};

export function carDetailBody(c, { more = [], banner = "", origin = "" } = {}) {
  const t = carTitle(c), tel = telHref(c.phone), sold = c.status === "sold";
  const site = (origin || "").replace(/^https?:\/\//, "");
  const sms = encodeURIComponent(`Hi! Is your ${t} still for sale? I saw it on ${site || "bardaleslabs.com"}/cars`);
  const specs = [["Year", c.year], ["Make", c.make], ["Model", c.model], ["Trim", c.trim], ["Mileage", milesLabel(c.mileage)], ["Body", c.body], ["Transmission", c.transmission], ["Fuel", c.fuel], ["Color", c.color], ["Title", c.title_status], ["Seller", c.seller]].filter(([, v]) => v != null && v !== "");
  const contact = sold ? html`<p class="car__note">This car has been sold. <a href="/cars/">See cars that are still available →</a></p>`
    : tel ? html`<div class="actions car__actions"><a class="btn" href="tel:${tel}" data-track="car_call">Call ${esc(phoneLabel(c.phone))}</a><a class="btn btn--ghost" href="sms:${tel}?&amp;body=${sms}" data-track="car_text">Text the seller</a></div>
      <p class="small muted">${c.status === "pending" ? "The seller may have a buyer lined up. Call to check. " : ""}Number from the seller's for-sale sign.</p>`
    : html`<p class="car__note">There was no phone number on the sign. <a href="#ask">Ask us about this car</a> and we'll try to connect you.</p>`;
  return html`${banner}
<section class="wrap car">
  <p class="eyebrow car__crumb"><a href="/cars/">Cars</a>${c.area ? html` · <a href="/cars/?area=${encodeURIComponent(c.area)}">${esc(c.area)}</a>` : ""}${c.make ? html` · <a href="/cars/?make=${encodeURIComponent(c.make)}">${esc(c.make)}</a>` : ""}</p>
  <div class="car__grid">
    <div class="car__media">${gallery(c)}</div>
    <aside class="car__side">
      ${badge(c.status)}
      <h1>${esc(t)}</h1>
      <p class="car__price">${c.price != null ? money(c.price) : "Ask for price"}</p>
      <p class="muted">${[milesLabel(c.mileage), c.area ? `${c.area}, Miami-Dade` : "Miami-Dade", c.spotted ? `spotted ${dayLabel(c.spotted)}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
      ${contact}
      ${specs.length ? html`<dl class="specs">${specs.map(([k, v]) => html`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)}</dl>` : ""}
      ${c.vin ? html`<p class="car__vin"><span>VIN</span> <span class="mono">${esc(c.vin)}</span></p>` : ""}
    </aside>
  </div>
  <div class="car__more">
    <div>${c.description ? html`<h2>From the seller</h2>${paragraphs(c.description)}` : ""}</div>
    <aside class="car__safety">
      <p class="eyebrow">Before you buy</p>
      <ul class="checks">
        <li>Meet in daylight in a busy public place. Many police stations have safe exchange zones.</li>
        <li>Run the VIN for theft and salvage records at <a href="https://www.nicb.org/vincheck" target="_blank" rel="noopener">NICB VINCheck</a> and for recalls at <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">NHTSA</a>.</li>
        <li>Make sure the name on the title matches the seller, and get a pre-purchase inspection.</li>
      </ul>
    </aside>
  </div>
</section>
${more.length ? html`<section class="wrap block"><p class="eyebrow">More cars for sale</p><div class="cars__grid cars__grid--4">${more.map(carCard)}</div><p class="more"><a href="/cars/">All cars in Miami-Dade →</a></p></section>` : ""}
<section class="contact" id="ask"><div class="wrap contact__grid">
  <div>
    <p class="eyebrow">Questions</p>
    <h2>Ask about this car, or ask us to take it down.</h2>
    <p class="lede">Is this your car? Tell us if it sold or the details changed and we'll update or remove the listing.</p>
    <p class="muted small">${esc(carsCopy.disclaimer)}</p>
  </div>
  ${contactForm({ interest: "Car directory", prompt: `Your message about the ${t}`, options: false, simple: true })}
</div></section>`;
}

export function carNotFoundBody() {
  return html`<section class="wrap page__hero">
  <p class="eyebrow"><a href="/cars/">Cars</a></p>
  <h1>That listing is gone.</h1>
  <p class="lede">The car may have sold or the seller asked us to take it down.</p>
  <div class="actions"><a class="btn" href="/cars/">See cars for sale</a></div>
</section>`;
}

// ---------- head / structured data
export function carHead(c, origin) {
  const t = carTitle(c), price = c.price != null ? money(c.price) : "";
  const url = `${origin}/cars/${c.id}/`, images = c.photos.map(id => origin + photoUrl(id));
  const jsonld = {
    "@context": "https://schema.org", "@type": "Car", name: t, url, ...(images.length ? { image: images } : {}),
    ...(c.make ? { brand: { "@type": "Brand", name: c.make } } : {}), ...(c.model ? { model: c.model } : {}), ...(c.year ? { vehicleModelDate: String(c.year) } : {}),
    ...(c.mileage != null ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: c.mileage, unitCode: "SMI" } } : {}),
    ...(c.vin ? { vehicleIdentificationNumber: c.vin } : {}), ...(c.color ? { color: c.color } : {}), ...(c.body ? { bodyType: c.body } : {}),
    ...(c.description ? { description: c.description.slice(0, 500) } : {}),
    offers: { "@type": "Offer", ...(c.price != null ? { price: c.price, priceCurrency: "USD" } : {}), availability: c.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock", areaServed: `${c.area ? c.area + ", " : ""}Miami-Dade County, FL` },
  };
  return {
    title: `${t} for sale${c.area ? ` in ${c.area}` : ""}${price ? ` · ${price}` : ""} · BardalesLabs Cars`,
    description: [milesLabel(c.mileage), c.spotted ? `Spotted ${dayLabel(c.spotted)}${c.area ? ` in ${c.area}` : ""}, Miami-Dade` : "Miami-Dade", sold(c) ? "Sold" : "Call or text the seller directly."].filter(Boolean).join(". "),
    image: images[0], url, jsonld, noindex: c.status === "draft",
  };
}
const sold = (c) => c.status === "sold";

export function carsIndexHead(origin, f, total) {
  const bits = [f.make, f.body, f.area && `in ${f.area}`].filter(Boolean).join(" ");
  return {
    title: bits ? `${bits} cars for sale · Miami-Dade · BardalesLabs` : "Cars for sale in Miami-Dade · BardalesLabs",
    description: `${total ? `${total} cars` : "Cars"} for sale around Miami-Dade, photographed with the seller's sign. Call or text sellers directly.`,
    url: `${origin}${carsQuery(f)}`,
  };
}
