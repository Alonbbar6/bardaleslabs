import "./styles.css";
import { initPage, gsap, ScrollTrigger, reduceMotion } from "./shared.js";
import { AGENTS, DEMO_STEPS, DEMO_TAIL, HOW_STEPS } from "./agents.js";

initPage();
const pageId = document.body.dataset.page;
const webgl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();
const small = matchMedia("(max-width: 900px)").matches;
const loadOffice = () => import("@office");
const feedLogger = (sel, max = 4) => { const feed = document.querySelector(sel); return feed ? (msg) => { const li = document.createElement("li"); li.textContent = msg; feed.appendChild(li); while (feed.children.length > max) feed.firstChild.remove(); } : () => {}; };

// counters
const cio = new IntersectionObserver((es) => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, to = +el.dataset.count, o = { v: 0 };
  if (reduceMotion()) return;
  gsap.to(o, { v: to, duration: 1.4, ease: "power2.out", onUpdate: () => el.textContent = Math.round(o.v).toLocaleString() });
}));
document.querySelectorAll("[data-count]").forEach(el => cio.observe(el));

// ---- hero office (home)
async function initHero() {
  const stage = document.querySelector("[data-office-stage]"), el = document.querySelector("[data-office]");
  if (!el || !webgl || reduceMotion() || small) return;
  const { createOffice, connectWebSocket, runDemo } = await loadOffice();
  const office = createOffice(el, { agents: AGENTS, controls: false, labels: false, background: 0x0b0d12, onLog: (m) => { const l = document.querySelector("[data-live-line]"); if (l) l.textContent = m; } });
  await office.ready;
  const L = office.layout, cx = L.center.x, cz = L.RZ * 0.5;
  office.controls.target.set(cx - 2.6, 0.6, cz);
  office.camera.position.set(cx - 2.0, 4.6, L.REVIEW.z + 4.4); office.controls.update();
  stage.classList.add("is-live");
  const ws = import.meta.env.VITE_AGENTS_WS;
  if (ws) connectWebSocket(office, ws); else runDemo(office, { steps: DEMO_STEPS, tail: DEMO_TAIL, stepSecs: 6 });
  let t = 0; office.addTick((dt) => { t += dt; office.camera.position.x = cx - 2.0 + Math.sin(t * 0.1) * 0.5; });
}

// ---- small office with feed (home "agents" section)
async function initMini() {
  const el = document.querySelector("[data-mini-office]");
  if (!el) return;
  if (!webgl) { el.innerHTML = `<img src="/office-poster.jpg" alt="" style="width:100%;height:100%;object-fit:cover">`; return; }
  const { createOffice, runDemo } = await loadOffice();
  const office = createOffice(el, { agents: AGENTS, controls: false, background: 0x161a22, onLog: feedLogger("#agents [data-feed]") });
  await office.ready;
  runDemo(office, { steps: DEMO_STEPS, tail: DEMO_TAIL, stepSecs: 6 });
}

// ---- services: pinned how-it-works driving the office
async function initHow() {
  const how = document.querySelector("[data-how]"), el = document.querySelector("[data-how-office]");
  if (!how || !el) return;
  const steps = [...how.querySelectorAll("[data-steps] li")], meter = how.querySelector("[data-how-meter]");
  const setStep = (n) => steps.forEach((li, i) => li.classList.toggle("is-on", i === n));
  setStep(0);
  let office = null;
  if (webgl) { const { createOffice } = await loadOffice(); office = createOffice(el, { agents: AGENTS, controls: false, background: 0x161a22, onLog: () => {} }); await office.ready; }
  else el.innerHTML = `<img src="/office-poster.jpg" alt="" style="width:100%;height:100%;object-fit:cover">`;
  const THREE = office ? await import("three") : null;
  const target = THREE ? new THREE.Vector3() : null, camTo = THREE ? new THREE.Vector3() : null;
  let current = -1;
  const apply = (n) => {
    if (n === current || !office) return; current = n;
    office.reset();
    const step = HOW_STEPS[n];
    for (const [agent, state, message, to] of step.states) office.dispatch({ type: "agent.state", agent, state, message, to });
    const d = office.deskOf(step.focus); target.set(d.x, 0.7, d.z - 0.2); camTo.set(d.x + 1.4, 3.4, d.z + 3.6);
  };
  if (office) { office.addTick(() => { office.controls.target.lerp(target, 0.06); office.camera.position.lerp(camTo, 0.06); }); apply(0); }
  // steps light up as they scroll past the middle of the viewport (works pinned or not)
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { const n = +e.target.dataset.step; setStep(n); apply(n); if (meter) meter.style.transform = `scaleX(${(n + 1) / steps.length})`; } }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach(li => io.observe(li));
}

// ---- lab: full office with controls, labels, feed and roster
async function initLab() {
  const el = document.querySelector("[data-lab-office]");
  if (!el) return;
  if (!webgl) { el.innerHTML = `<img src="/office-poster.jpg" alt="" style="width:100%;height:100%;object-fit:cover">`; return; }
  const { createOffice, connectWebSocket, runDemo } = await loadOffice();
  const office = createOffice(el, { agents: AGENTS, background: 0x161a22, onLog: feedLogger(".lab__stage [data-feed]", 5) });
  await office.ready;
  const ws = import.meta.env.VITE_AGENTS_WS;
  if (ws) connectWebSocket(office, ws); else runDemo(office, { steps: DEMO_STEPS, tail: DEMO_TAIL, stepSecs: 6 });
  const roster = document.querySelector("[data-roster]");
  roster.innerHTML = AGENTS.map(a => `<li data-agent="${a.id}"><b>${a.name}</b><span>idle</span></li>`).join("");
  setInterval(() => { for (const s of office.snapshot()) { const li = roster.querySelector(`[data-agent="${s.agent}"]`); if (li) { li.querySelector("span").textContent = s.message; li.dataset.state = s.state; } } }, 250);
}

// ---- work filters
function initFilters() {
  const grid = document.querySelector("[data-work-grid]"); if (!grid) return;
  document.querySelectorAll("[data-filter]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault(); const k = a.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("is-on", x === a));
    grid.querySelectorAll("[data-kind]").forEach(c => c.hidden = k !== "all" && c.dataset.kind !== k);
  }));
}

// ---- contact: preselect interest from ?interest=
(() => { const i = new URLSearchParams(location.search).get("interest"); const sel = document.querySelector('select[name="interest"]'); if (i && sel) { const o = [...sel.options].find(o => o.text === i); if (o) o.selected = true; } })();

// ---- home: scale-style pinned scenes + DOM motion
async function initHomeFX() {
  if (document.body.dataset.page !== "home") return;
  const { wordReveal, staggerIn, fanCarousel } = await import("./fx/dom.js");
  const words = document.querySelector("[data-words]"); if (words && !reduceMotion()) wordReveal(words);
  document.querySelectorAll("[data-stagger]").forEach(el => { if (!reduceMotion()) staggerIn(el); });
  const fan = document.querySelector("[data-fan]"); if (fan) fanCarousel(fan, { auto: reduceMotion() ? 0 : 4500 });

  const pin = !small && !reduceMotion();
  const stepper = (sel, dotSel) => (n) => { document.querySelectorAll(sel).forEach((el, i) => el.classList.toggle("is-on", i === n)); if (dotSel) document.querySelectorAll(dotSel).forEach((el, i) => el.classList.toggle("is-on", i === n)); };

  // story: network grows with scroll
  const story = document.querySelector("[data-story]"), netCanvas = document.querySelector("[data-network]");
  if (story && netCanvas) {
    const setStep = stepper("[data-story-step]", "[data-story-dot]");
    let net = null;
    if (webgl) { const { createNetwork } = await import("./fx/network.js"); net = createNetwork(netCanvas, { poster: "/office-poster.jpg" }); }
    const steps = 4;
    if (pin) {
      ScrollTrigger.create({ trigger: story, start: "top top", end: "+=320%", pin: "[data-story-pin]", scrub: 0.6, anticipatePin: 1,
        onUpdate: (s) => { net?.setProgress(0.08 + s.progress * 0.92); setStep(Math.min(steps - 1, Math.floor(s.progress * steps * 0.999))); } });
    } else { story.classList.add("is-static"); net?.setProgress(1); }
  }

  // products: layered planes
  const pl = document.querySelector("[data-planes]"), plCanvas = document.querySelector("[data-planes-canvas]");
  if (pl && plCanvas) {
    const setStep = stepper("[data-planes-step]");
    let planes = null;
    if (webgl) { const { createPlanes } = await import("./fx/planes.js"); planes = await createPlanes(plCanvas, { steps: [{ draw: "leadgen" }, { draw: "socialsnap" }, { draw: "agents" }], poster: "/office-poster.jpg" }); }
    if (pin) {
      ScrollTrigger.create({ trigger: pl, start: "top top", end: "+=220%", pin: "[data-planes-pin]", scrub: 0.6, anticipatePin: 1,
        onUpdate: (s) => { planes?.setProgress(s.progress); setStep(Math.min(2, Math.floor(s.progress * 3 * 0.999))); } });
    } else { pl.classList.add("is-static"); planes?.setProgress(0); }
  }
}

initFilters();
Promise.all([initHero(), initMini(), initHow(), initLab(), initHomeFX()]).then(() => ScrollTrigger.refresh());
addEventListener("load", () => ScrollTrigger.refresh());
void pageId;
