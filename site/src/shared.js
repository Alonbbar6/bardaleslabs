import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };
export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initPage() {
  document.documentElement.classList.add("js");
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  if (import.meta.env.VITE_AGENTS_URL) document.querySelectorAll("[data-agents-link]").forEach(a => a.href = import.meta.env.VITE_AGENTS_URL);

  const nav = document.querySelector("[data-nav]");
  addEventListener("scroll", () => nav.classList.toggle("is-scrolled", scrollY > 8), { passive: true });
  const toggle = document.querySelector("[data-nav-toggle]");
  toggle?.addEventListener("click", () => { const open = nav.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", open); });
  document.querySelectorAll("[data-nav-links] a").forEach(a => a.addEventListener("click", () => nav.classList.remove("is-open")));

  let lenis = null;
  if (!reduceMotion()) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]:not([data-filter])').forEach(a => a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href")); if (!el) return;
      e.preventDefault(); lenis.scrollTo(el, { offset: -70 }); history.pushState(null, "", a.getAttribute("href"));
    }));
  }

  // line reveals: one effect, used everywhere
  const io = new IntersectionObserver((entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });

  document.querySelectorAll("[data-form]").forEach(initForm);
  return lenis;
}

function initForm(form) {
  const status = form.querySelector("[data-form-status]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // honeypot
    status.className = "form__status"; status.textContent = "Sending…";
    const btn = form.querySelector("button"); btn.disabled = true;
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, page: location.pathname }) });
      if (!r.ok) throw new Error(await r.text());
      status.classList.add("is-ok"); status.textContent = "Thanks — you'll hear from Alonso within one business day."; form.reset();
    } catch {
      // no backend (local dev / not configured yet): hand off to the mail client with everything filled in
      const body = `Name: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || "-"}\nInterest: ${data.interest || "-"}\n\n${data.message}`;
      location.href = `mailto:alonso@bardaleslabs.com?subject=${encodeURIComponent(`Call request — ${data.company || data.name}`)}&body=${encodeURIComponent(body)}`;
      status.classList.add("is-ok"); status.textContent = "Opening your email app — send the message and we'll reply within one business day.";
    } finally { btn.disabled = false; }
  });
}
