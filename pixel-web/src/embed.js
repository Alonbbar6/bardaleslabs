import { createOffice, connectWebSocket, runDemo } from "./office/index.js";

const q = new URLSearchParams(location.search);
const feed = document.querySelector("[data-feed]");
const log = (msg) => { const li = document.createElement("li"); li.textContent = msg; feed.appendChild(li); while (feed.children.length > 4) feed.firstChild.remove(); };

const office = createOffice(document.querySelector("[data-office]"), { onLog: log, controls: q.get("controls") !== "0" });
office.ready.then(() => {
  document.querySelector("[data-loading]").remove();
  const ws = q.get("ws");
  if (ws) connectWebSocket(office, ws, { onStatus: (s) => log(`connection: ${s}`) });
  else runDemo(office);
});
// parent pages can also post events: iframe.contentWindow.postMessage({ type: "agent.state", ... }, "*")
addEventListener("message", (e) => office.dispatch(e.data));
