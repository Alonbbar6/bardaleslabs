import { html, esc, page } from "./layout.mjs";
import { cta, sectionHead, workCard, serviceTile, appCard, productCard, contactForm, contactBand, ctaBand } from "./components.mjs";
import { company } from "../data/company.js";
import { services, serviceById } from "../data/services.js";
import { work, workById, KINDS } from "../data/work.js";
import { apps, appsNote } from "../data/apps.js";
import { products, productById } from "../data/products.js";
import { bio, pillars, principles, timeline, capabilities } from "../data/about.js";

const officeStage = (cls, attr) => html`<div class="${cls}__stage" data-office-stage>
  <div class="${cls}__office" ${attr} aria-hidden="true"></div>
  <img class="${cls}__poster" src="/office-poster.jpg" alt="" width="1600" height="900" />
  <div class="${cls}__shade"></div>
</div>`;

// ---------------- home
export function home() {
  const featured = work.filter(w => w.featured);
  const body = html`
<section class="hero" id="top">
  ${officeStage("hero", "data-office")}
  <div class="wrap hero__copy">
    <p class="eyebrow" data-reveal>AI solutions · software · products · partnerships</p>
    <h1 data-reveal>${esc(company.tagline)}</h1>
    <p class="lede" data-reveal>${esc(company.positioning)}</p>
    <div class="actions" data-reveal>${cta()}${cta("See our work", "/work/", "btn btn--ghost")}</div>
    <p class="hero__live mono" data-reveal><span class="dot"></span><span data-live-line>Our lead-gen agents, at work</span></p>
  </div>
</section>

<section class="proof wrap" aria-label="Numbers">
  ${company.stats.map(s => html`<div data-reveal><b data-count="${s.value}">${s.value}</b><span>${esc(s.label)}</span><small class="muted">${esc(s.note)}</small></div>`)}
</section>

<section class="block wrap" id="what">
  ${sectionHead("What we do", "Six ways to work with BardalesLabs.", "Hire us to build, buy what we've built, or partner on something funded. Every engagement ends with software that runs.")}
  <div class="tiles">${services.map(serviceTile)}</div>
</section>

<section class="block wrap" id="work">
  ${sectionHead("Selected work", "Systems we built and run.")}
  <div class="cards cards--2">${featured.map(workCard)}</div>
  <p class="more" data-reveal><a href="/work/">All ${work.length} case studies →</a></p>
</section>

<section class="block wrap" id="agents">
  <div class="split">
    <div>
      ${sectionHead("Our lead-generation floor", "Six agents. One person in charge.", "This is the system behind our lead-generation service, shown live. Research, writing, checking, outreach, follow-up and booking each have an agent; a human approves the profile and reads every reply.")}
      <div class="actions" data-reveal>${cta("How lead generation works", "/services/#lead-generation")}${cta("Watch the agents", company.agentsUrl, "btn btn--ghost")}</div>
    </div>
    <div class="split__stage" data-reveal>
      <div class="mini-office" data-mini-office aria-hidden="true"></div>
      <ol class="feed" data-feed></ol>
    </div>
  </div>
</section>

<section class="block wrap" id="store">
  ${sectionHead("Store", "Products you can buy today.")}
  <div class="cards cards--3">${products.map(productCard)}</div>
</section>

<section class="block wrap" id="founder">
  <div class="founder" data-reveal>
    <div class="founder__photo" aria-hidden="true"><span>AB</span></div>
    <div>
      <p class="eyebrow">Founder</p>
      <h2>${esc(company.founder.name)}, ${company.founder.age}. Software engineer, Miami.</h2>
      <p class="lede">${esc(bio[3])}</p>
      <p class="muted">Bring a big project, propose a partnership, or hire him for contract or remote work.</p>
      <div class="actions">${cta("About BardalesLabs", "/about/", "btn btn--ghost")}${cta("Work with Alonso")}</div>
    </div>
  </div>
</section>

<section class="block wrap" id="partners">
  <p class="eyebrow" data-reveal>Worked with</p>
  <ul class="logos" data-reveal>${company.partners.map(p => html`<li>${esc(p)}</li>`)}</ul>
</section>

${contactBand()}`;
  return page({ title: "BardalesLabs — AI systems, apps and software that do real work", description: company.positioning, body, active: "/", pageId: "home" });
}

// ---------------- services
export function servicesPage() {
  const lg = serviceById["lead-generation"];
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("Services", "Build, automate, sell, partner.", "Six service lines, one engineer-led company. Pick the one you need; we'll tell you honestly if it's a fit.")}
  <nav class="subnav" data-reveal>${services.map(s => html`<a href="#${s.id}">${esc(s.title)}</a>`)}</nav>
</section>
${services.map(s => html`
<section class="service wrap" id="${s.id}">
  <div class="service__grid">
    <div>
      <p class="eyebrow" data-reveal>${s.n} · Service</p>
      <h2 data-reveal>${esc(s.title)}</h2>
      <p class="lede" data-reveal>${esc(s.short)}</p>
      <p data-reveal>${esc(s.body)}</p>
      <ul class="checks" data-reveal>${s.points.map(p => html`<li>${esc(p)}</li>`)}</ul>
      <div class="actions" data-reveal>${cta(s.cta, s.ctaHref ?? "/contact/")}</div>
    </div>
    <aside class="service__side" data-reveal>
      ${s.office ? html`
      <div class="how" data-how>
        <div class="how__stage"><div class="how__office" data-how-office aria-hidden="true"></div><div class="how__meter"><span data-how-meter></span></div></div>
        <ol class="steps" data-steps>${s.steps.map((st, i) => html`<li data-step="${i}" data-agent="${st.agent}"><h3>${esc(st.title)}</h3><p>${esc(st.body)}</p></li>`)}</ol>
      </div>` : ""}
      ${s.work.length ? html`<p class="eyebrow">Related work</p><ul class="related">${s.work.map(id => workById[id]).filter(Boolean).map(w => html`<li><a href="/work/${w.id}/"><b>${esc(w.title)}</b><span>${esc(w.tag)}</span></a></li>`)}</ul>` : ""}
    </aside>
  </div>
</section>`)}
${contactBand("Which of these is it?", "Tell us the problem; we'll say which service fits, or that none does.")}`;
  void lg;
  return page({ title: "Services — BardalesLabs", description: "AI solutions and agents, software and web platforms, iOS apps, lead generation, AI advisory and contract work, grant partnerships.", body, active: "/services/", pageId: "services", depth: 1 });
}

// ---------------- work
export function workIndex() {
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("Work", `${work.length} systems, built and run.`, "Platforms, AI pipelines, products, iOS apps and client sites. Each one shipped and operated by BardalesLabs.")}
  <nav class="subnav filters" data-reveal>
    <a href="#" class="is-on" data-filter="all">All</a>${KINDS.map(k => html`<a href="#" data-filter="${esc(k)}">${esc(k)}</a>`)}
  </nav>
</section>
<section class="wrap">
  <div class="cards cards--2" data-work-grid>${work.map(w => html`<div data-kind="${esc(w.kind)}">${workCard(w)}</div>`)}</div>
</section>
${ctaBand("Have something like this in mind?")}`;
  return page({ title: "Work — BardalesLabs", description: "Case studies: platforms, AI pipelines, products, iOS apps and client sites built by BardalesLabs.", body, active: "/work/", pageId: "work", depth: 1 });
}

export function workPage(w) {
  const i = work.indexOf(w), next = work[(i + 1) % work.length];
  const svc = services.filter(s => s.work.includes(w.id));
  const body = html`
<section class="wrap page__hero case">
  <p class="eyebrow" data-reveal><a href="/work/">Work</a> · ${esc(w.kind)} · ${esc(w.year)}</p>
  <h1 data-reveal>${esc(w.title)}</h1>
  <p class="lede" data-reveal>${esc(w.summary)}</p>
  <p class="metric metric--big" data-reveal><b>${esc(w.metric.value)}</b><span>${esc(w.metric.label)}</span></p>
</section>
<section class="wrap case__grid">
  <div>
    <h2 data-reveal>What it does</h2>
    <p data-reveal>${esc(w.detail)}</p>
    <h2 data-reveal>Highlights</h2>
    <ul class="checks" data-reveal>${w.points.map(p => html`<li>${esc(p)}</li>`)}</ul>
  </div>
  <aside class="case__side" data-reveal>
    <p class="eyebrow">Stack</p><ul class="chips">${w.stack.map(s => html`<li>${esc(s)}</li>`)}</ul>
    ${svc.length ? html`<p class="eyebrow">Service</p><ul class="related">${svc.map(s => html`<li><a href="/services/#${s.id}"><b>${esc(s.title)}</b></a></li>`)}</ul>` : ""}
    ${w.product ? html`<p class="eyebrow">Buy it</p><p><a class="btn" href="/store/${w.product}/">${esc(productById[w.product].name)} →</a></p>` : ""}
    ${w.app ? html`<p class="eyebrow">App</p><p><a class="btn btn--ghost" href="/apps/">See the iOS apps</a></p>` : ""}
  </aside>
</section>
<section class="wrap next" data-reveal><span class="muted">Next</span><a href="/work/${next.id}/">${esc(next.title)} →</a></section>
${ctaBand("Want something like this built for you?")}`;
  return page({ title: `${w.title} — BardalesLabs`, description: w.summary, body, active: "/work/", pageId: "case", depth: 2 });
}

// ---------------- apps
export function appsPage() {
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("iOS apps", "Native apps, on the App Store.", appsNote)}
</section>
<section class="wrap"><div class="cards cards--3">${apps.map(appCard)}</div></section>
<section class="wrap block">
  ${sectionHead("Need an app?", "We take iOS apps from sketch to App Store review.", "SwiftUI, iCloud sync, natural-language input, companion dashboards. See the iOS service for how we work.")}
  <div class="actions" data-reveal>${cta("iOS app development", "/services/#ios", "btn btn--ghost")}${cta()}</div>
</section>`;
  return page({ title: "iOS apps — BardalesLabs", description: appsNote, body, active: "/apps/", pageId: "apps", depth: 1 });
}

// ---------------- store
export function storeIndex() {
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("Store", "Products you can buy today.", "Software we built for ourselves and now sell: a social media scheduler, the live agent office, and the characters inside it.")}
</section>
<section class="wrap"><div class="cards cards--3">${products.map(productCard)}</div></section>
${ctaBand("Want a custom version of any of these?", "Talk to us")}`;
  return page({ title: "Store — BardalesLabs", description: "SocialSnap, the Agents at Work embed and the office worker character pack.", body, active: "/store/", pageId: "store", depth: 1 });
}

export function productPage(p) {
  const w = p.work ? workById[p.work] : null;
  const buy = p.buy ? html`<a class="btn btn--buy" href="${p.buy === "STRIPE_LINK" ? "%%STRIPE_LINK%%" : p.buy}" data-buy target="_blank" rel="noopener">${esc(p.cta)}</a>`
                    : html`<a class="btn btn--buy" href="/contact/?interest=${encodeURIComponent(p.ctaInterest)}">${esc(p.cta)}</a>`;
  const link = p.link ? html`<a class="btn btn--ghost" href="${p.link === "AGENTS_URL" ? company.agentsUrl : p.link}"${p.link === "AGENTS_URL" ? " data-agents-link" : ""}>${esc(p.linkLabel)}</a>` : "";
  const body = html`
<section class="wrap page__hero product__hero">
  <div>
    <p class="eyebrow" data-reveal><a href="/store/">Store</a> · ${esc(p.kind)}</p>
    <h1 data-reveal>${esc(p.name)}</h1>
    <p class="lede" data-reveal>${esc(p.short)}</p>
    <div class="actions" data-reveal>${buy}${link}</div>
  </div>
  <aside class="pricebox" data-reveal>
    <p class="price price--big"><b>${esc(p.price)}</b><span>${esc(p.per)}</span></p>
    <p class="muted small">${esc(p.priceNote)}</p>
    ${buy}
  </aside>
</section>
<section class="wrap">
  <p data-reveal class="lede">${esc(p.body)}</p>
  <div class="features">${p.features.map(([t, d]) => html`<div data-reveal><b>${esc(t)}</b><p>${esc(d)}</p></div>`)}</div>
  ${w ? html`<p class="more" data-reveal><a href="/work/${w.id}/">How ${esc(w.title)} was built →</a></p>` : ""}
</section>
${p.id === "socialsnap" ? html`<section class="wrap block"><div class="split"><div>${sectionHead("How it works", "Three steps, then it runs.", "")}<ol class="steps steps--static">
  <li class="is-on"><h3>Connect your accounts</h3><p>Instagram Business and YouTube, through their official APIs. We never see your password.</p></li>
  <li class="is-on"><h3>Fill the queue</h3><p>Headline, caption, images or a video. Or drop in a call recording and let Call Cartoons make the reel.</p></li>
  <li class="is-on"><h3>Pick a cadence</h3><p>Every day, every other day, weekdays. SocialSnap posts, checks limits, and shows you what went out.</p></li>
</ol></div><div class="split__stage queue" aria-hidden="true">
  <div class="queue__head"><span>posts.csv</span><span class="queue__pill">next run: Thu 9:00</span></div>
  ${[["Nov 05", "New: same-day delivery in Wynwood", "posted"], ["Nov 07", "Behind the counter: how we pack an order", "posted"], ["Nov 09", "Reel · cold call #14 (Call Cartoons)", "queued"], ["Nov 11", "Three stylists, one question", "queued"], ["Nov 13", "Client story: Miami Market", "draft"]].map(([d, t, s]) => html`<div class="queue__row"><span class="mono">${d}</span><span>${esc(t)}</span><em class="queue__${s}">${s}</em></div>`)}
</div></div></section>` : ""}
<section class="contact" id="contact"><div class="wrap contact__grid">
  <div data-reveal><p class="eyebrow">${p.buy ? "Questions" : "Get access"}</p><h2>${p.buy ? "Need a different license?" : `Request ${esc(p.name)}`}</h2><p class="lede">${p.buy ? "Team, studio or redistribution licenses on request." : "Tell us about your accounts and what you post. We'll set you up and confirm pricing."}</p></div>
  ${contactForm({ interest: p.ctaInterest ?? "Something else", prompt: "What would you use it for?", options: false })}
</div></section>`;
  return page({ title: `${p.name} — BardalesLabs Store`, description: p.short, body, active: "/store/", pageId: "product", depth: 2 });
}

// ---------------- lab
export function labPage() {
  const building = work.filter(w => ["socialsnap", "vibeleads", "lead-radar", "laptop-store"].includes(w.id));
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("Lab", "What's running right now.", "Our own systems, live. The lead-generation floor below is the real thing: six agents, each with a job, and a person in the loop.")}
</section>
<section class="wrap">
  <div class="lab__stage" data-reveal>
    <div class="lab__office" data-lab-office aria-hidden="true"></div>
    <ol class="feed" data-feed></ol>
    <ul class="roster" data-roster></ul>
  </div>
  <p class="muted small" data-reveal>Drag to orbit · scroll to zoom. Want this for your own agents? <a href="/store/agent-office/">It's in the store.</a></p>
</section>
<section class="wrap block">
  ${sectionHead("In progress", "Being built and operated now.")}
  <div class="cards cards--2">${building.map(workCard)}</div>
</section>
<section class="wrap block">
  ${sectionHead("How we build", "Four rules every system follows.")}
  <div class="features">${principles.map(p => html`<div data-reveal><b>${p.k} · ${esc(p.t)}</b><p>${esc(p.d)}</p></div>`)}</div>
</section>
${ctaBand("Want to partner on an experiment?", "Propose a partnership")}`;
  return page({ title: "Lab — BardalesLabs", description: "Watch BardalesLabs' AI agents at work and see what's being built right now.", body, active: "/lab/", pageId: "lab", depth: 1 });
}

// ---------------- about
export function aboutPage() {
  const f = company.founder;
  const body = html`
<section class="wrap page__hero">
  ${sectionHead("About", "Innovative tech solutions. A business that runs smoother with AI.", bio[0])}
</section>
<section class="wrap">
  <div class="features features--4">${pillars.map((p, i) => html`<div data-reveal><b>0${i + 1} · ${esc(p.t)}</b><p>${esc(p.d)}</p></div>`)}</div>
</section>
<section class="wrap about__grid">
  <div>
    ${bio.slice(1).map(p => html`<p class="lede" data-reveal>${esc(p)}</p>`)}
    <h2 data-reveal>Work with BardalesLabs</h2>
    <ul class="checks" data-reveal>
      <li>Bring a project: we scope it, present the solution, and build it</li>
      <li>Partner: grants, challenges, pilots and revenue-share products</li>
      <li>Hire Alonso: contract engagements or a remote engineering role</li>
    </ul>
    <div class="actions" data-reveal>${cta("Book a call")}<a class="btn btn--ghost" href="${f.linkedin}" target="_blank" rel="noopener">LinkedIn</a><a class="btn btn--ghost" href="${f.github}" target="_blank" rel="noopener">GitHub</a></div>
  </div>
  <aside data-reveal>
    <div class="founder__photo founder__photo--lg" aria-hidden="true"><span>AB</span></div>
    <p><b>${esc(f.name)}</b><br /><span class="muted">${esc(f.title)} · ${f.age} · ${esc(f.location)}</span></p>
    <p class="eyebrow">Capabilities</p><ul class="chips">${capabilities.map(c => html`<li>${esc(c)}</li>`)}</ul>
  </aside>
</section>
<section class="wrap block">
  ${sectionHead("Principles", "How we build.")}
  <div class="features">${principles.map(p => html`<div data-reveal><b>${p.k} · ${esc(p.t)}</b><p>${esc(p.d)}</p></div>`)}</div>
</section>
<section class="wrap block">
  ${sectionHead("Timeline", "Where the work has been.")}
  <ol class="timeline">${timeline.map(t => html`<li data-reveal><span class="mono">${esc(t.when)}</span><div><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div><em>${esc(t.tag)}</em></li>`)}</ol>
</section>
${contactBand("Work with Alonso.", "Contract, remote role or partnership. One email is enough to start.")}`;
  return page({ title: "About — BardalesLabs", description: bio[0], body, active: "/about/", pageId: "about", depth: 1 });
}

// ---------------- contact
export function contactPage() {
  const body = html`
<section class="contact contact--page" id="contact"><div class="wrap contact__grid">
  <div data-reveal>
    <p class="eyebrow">Contact</p>
    <h1>Book a call.</h1>
    <p class="lede">Tell us what you sell, what you want built, or what you'd like to partner on. We reply within one business day.</p>
    <address><b>${esc(company.founder.name)}</b>, ${esc(company.founder.title)}<br /><a href="mailto:${company.founder.email}">${company.founder.email}</a><br />${esc(company.founder.location)}</address>
  </div>
  ${contactForm()}
</div></section>`;
  return page({ title: "Contact — BardalesLabs", description: "Book a call with BardalesLabs.", body, active: "/contact/", pageId: "contact", depth: 1 });
}

export function allPages() {
  const out = { "index.html": home(), "services/index.html": servicesPage(), "work/index.html": workIndex(), "apps/index.html": appsPage(), "store/index.html": storeIndex(), "lab/index.html": labPage(), "about/index.html": aboutPage(), "contact/index.html": contactPage() };
  for (const w of work) out[`work/${w.id}/index.html`] = workPage(w);
  for (const p of products) out[`store/${p.id}/index.html`] = productPage(p);
  return out;
}
