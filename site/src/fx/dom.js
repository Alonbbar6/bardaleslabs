import { gsap, ScrollTrigger } from "../shared.js";

/** Split text into words and reveal them one by one when scrolled into view. */
export function wordReveal(el, { stagger = 0.045, start = "top 80%" } = {}) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="w"><span>${w}</span></span>`).join(" ");
  const inner = el.querySelectorAll(".w > span");
  gsap.set(inner, { yPercent: 110, opacity: 0 });
  ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => gsap.to(inner, { yPercent: 0, opacity: 1, duration: 0.7, ease: "power3.out", stagger }) });
}

/** Cards fade + rise with a stagger when their container enters. */
export function staggerIn(container, sel = ":scope > *") {
  const items = container.querySelectorAll(sel);
  gsap.set(items, { y: 40, opacity: 0 });
  ScrollTrigger.create({ trigger: container, start: "top 78%", once: true, onEnter: () => gsap.to(items, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.12 }) });
}

/** Fanned card carousel: centre card large, neighbours recede. */
export function fanCarousel(root, { auto = 4500 } = {}) {
  const track = root.querySelector("[data-fan-track]"), cards = [...track.children];
  let active = Math.floor(cards.length / 2), timer;
  const layout = (animate = true) => {
    const w = root.clientWidth, step = Math.min(w * 0.3, 400);
    cards.forEach((c, i) => {
      const d = i - active, ad = Math.abs(d);
      const props = { x: d * step, scale: 1 - Math.min(ad, 3) * 0.1, y: ad * 14, opacity: ad > 2 ? 0 : 1 - ad * 0.25, zIndex: 10 - ad, duration: animate ? 0.7 : 0, ease: "power3.out", overwrite: true };
      gsap.to(c, props); c.classList.toggle("is-active", d === 0); c.setAttribute("aria-hidden", d !== 0);
    });
  };
  const go = (n) => { active = (n + cards.length) % cards.length; layout(); restart(); };
  const restart = () => { clearInterval(timer); if (auto) timer = setInterval(() => go(active + 1), auto); };
  root.querySelector("[data-fan-prev]")?.addEventListener("click", () => go(active - 1));
  root.querySelector("[data-fan-next]")?.addEventListener("click", () => go(active + 1));
  cards.forEach((c, i) => c.addEventListener("click", (e) => { if (i !== active) { e.preventDefault(); go(i); } }));
  addEventListener("resize", () => layout(false));
  layout(false); restart();
  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) clearInterval(timer); else restart(); }); io.observe(root);
}
