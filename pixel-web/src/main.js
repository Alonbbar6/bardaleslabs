import { createOffice, connectWebSocket, runDemo, DEFAULT_AGENTS } from "./office/index.js";

const $ = (s) => document.querySelector(s);
const feed = $("[data-feed]"), status = $("[data-status]"), roster = $("[data-roster]");
const log = (msg) => { const li = document.createElement("li"); li.textContent = msg; feed.appendChild(li); while (feed.children.length > 5) feed.firstChild.remove(); };

const office = createOffice($("[data-office]"), { onLog: log });
let stop = null;
const setMode = (mode, wsUrl) => {
  stop && stop(); stop = null;
  document.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("is-on", b.dataset.mode === mode));
  if (mode === "live" && wsUrl) { status.textContent = "connecting"; stop = connectWebSocket(office, wsUrl, { onStatus: (s) => { status.textContent = s; status.dataset.state = s; } }); }
  else { status.textContent = "demo"; status.dataset.state = "demo"; stop = runDemo(office); }
};

office.ready.then(() => {
  $("[data-loading]").remove();
  const params = new URLSearchParams(location.search);
  const ws = params.get("ws") || import.meta.env.VITE_AGENTS_WS;
  if (ws) { $("[data-ws]").value = ws; setMode("live", ws); } else setMode("demo");
});

$("[data-mode='demo']").onclick = () => { $("[data-ws]").hidden = true; setMode("demo"); };
$("[data-mode='live']").onclick = () => {
  const input = $("[data-ws]"); input.hidden = false; input.focus();
  if (input.value) setMode("live", input.value);
};
$("[data-ws]").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.value) setMode("live", e.target.value); });

// roster: live state per agent, mirrors the labels in the scene
roster.innerHTML = DEFAULT_AGENTS.map(a => `<li data-agent="${a.id}"><b>${a.name}</b><span>idle</span></li>`).join("");
setInterval(() => { for (const s of office.snapshot()) { const li = roster.querySelector(`[data-agent="${s.agent}"]`); if (li) { li.querySelector("span").textContent = s.message; li.dataset.state = s.state; } } }, 250);

// embed snippet + store
document.querySelectorAll("[data-origin]").forEach(el => el.textContent = location.origin);
const buy = $("[data-buy]");
const link = import.meta.env.VITE_STRIPE_LINK;
if (link) buy.href = link; else { buy.href = "mailto:hello@bardaleslabs.com?subject=Character%20pack%20license"; buy.textContent = "Request the character pack · $5"; }
$("[data-pack]").innerHTML = DEFAULT_AGENTS.map(a => `<figure><div class="pack__swatch pack__swatch--${a.id}"></div><figcaption>${a.name}<small>${a.model}.glb</small></figcaption></figure>`).join("");
