import { html, esc } from "./layout.mjs";
import { company } from "../data/company.js";

export const cta = (label = company.cta.label, href = company.cta.href, cls = "btn") => html`<a href="${href}" class="${cls}">${esc(label)}</a>`;

export const sectionHead = (eyebrow, title, lede = "") => html`
  <p class="eyebrow" data-reveal>${esc(eyebrow)}</p>
  <h2 data-reveal>${esc(title)}</h2>
  ${lede ? html`<p class="lede" data-reveal>${esc(lede)}</p>` : ""}`;

export const workCard = (w) => html`<a class="card card--link" href="/work/${w.id}/" data-reveal>
  <p class="eyebrow">${esc(w.kind)} · ${esc(w.year)}</p>
  <h3>${esc(w.title)}</h3>
  <p class="card__tag">${esc(w.tag)}</p>
  <p class="muted">${esc(w.summary)}</p>
  <p class="metric"><b>${esc(w.metric.value)}</b><span>${esc(w.metric.label)}</span></p>
</a>`;

export const serviceTile = (s) => html`<a class="tile" href="/services/#${s.id}" data-reveal>
  <span class="tile__n">${s.n}</span>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.short)}</p>
</a>`;

export const appCard = (a) => html`<article class="card app" data-reveal style="--accent:${a.accent}">
  <div class="app__icon"><span>${esc(a.name[0])}</span></div>
  <p class="eyebrow">${esc(a.category)} · ${esc(a.status)}</p>
  <h3>${esc(a.name)}</h3>
  <p class="muted">${esc(a.body)}</p>
  <ul class="chips">${a.feats.map(f => html`<li>${esc(f)}</li>`)}</ul>
  ${a.store ? html`<a class="btn btn--ghost" href="${a.store}" target="_blank" rel="noopener">View on the App Store</a>` : html`<a class="btn btn--ghost" href="/work/${a.id}/">Read the case study</a>`}
</article>`;

export const productCard = (p) => html`<article class="card product" data-reveal>
  <p class="eyebrow">${esc(p.kind)}</p>
  <h3>${esc(p.name)}</h3>
  <p class="muted">${esc(p.short)}</p>
  <p class="price"><b>${esc(p.price)}</b><span>${esc(p.per)}</span></p>
  <a class="btn" href="/store/${p.id}/">Details</a>
</article>`;

// simple: shoppers rather than businesses (no company field, plain "Email")
export const contactForm = ({ interest = "", prompt = "What do you need built, sold or automated?", options = true, simple = false } = {}) => html`<form class="form" data-form novalidate>
  <label>Name<input name="name" required autocomplete="name" /></label>
  <label>${simple ? "Email" : "Work email"}<input name="email" type="email" required autocomplete="email" /></label>
  ${simple ? "" : html`<label>Company<input name="company" autocomplete="organization" /></label>`}
  <label>${esc(prompt)}<textarea name="message" rows="4" required></textarea></label>
  ${options ? html`<label class="form__select">I'm interested in
    <select name="interest">${["Lead generation", "AI solutions and agents", "Software and web platforms", "iOS app", "AI advisory and contract work", "Grant or innovation partnership", "Hiring Alonso (contract or remote)", "SocialSnap", "Agents at Work embed", "Digital products", "Car directory", "Something else"].map(o => html`<option${o === interest ? " selected" : ""}>${esc(o)}</option>`)}</select>
  </label>` : html`<input type="hidden" name="interest" value="${esc(interest)}" />`}
  <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" />
  <button class="btn" type="submit">Send</button>
  <p class="form__status" data-form-status aria-live="polite"></p>
</form>`;

export const contactBand = (title = "Tell us what you're building.", lede = "We reply within one business day with whether it's a fit and what the first step looks like.") => html`<section class="contact" id="contact">
  <div class="wrap contact__grid">
    <div data-reveal>
      <p class="eyebrow">Talk to us</p>
      <h2>${esc(title)}</h2>
      <p class="lede">${esc(lede)}</p>
      <address><b>${esc(company.founder.name)}</b>, ${esc(company.founder.title)}<br /><a href="mailto:${company.founder.email}">${company.founder.email}</a><br />${esc(company.founder.location)}</address>
    </div>
    ${contactForm()}
  </div>
</section>`;

export const ctaBand = (title, label = company.cta.label, href = company.cta.href) => html`<section class="band wrap" data-reveal>
  <h2>${esc(title)}</h2>${cta(label, href)}
</section>`;
