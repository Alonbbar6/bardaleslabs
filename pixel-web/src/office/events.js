// Transports that feed events into an office created by createOffice().

/**
 * Connect the office to a WebSocket that sends JSON events, one per message.
 * Event schema:
 *   { "type": "agent.state", "agent": "intake", "state": "typing", "message": "reading the brief" }
 *   { "type": "agent.state", "agent": "intake", "state": "carry", "to": "designer" }       // to: agent id | "review"
 *   { "type": "agent.state", "agent": "critic", "state": "carry", "to": "reviser", "warn": true }
 *   { "type": "agent.state", "agent": "critic", "state": "waiting", "message": "waiting for approval" }
 *   { "type": "run.log",     "message": "Run 42 started" }
 *   { "type": "run.reset" }
 * Arrays of events are accepted too. Reconnects with backoff; returns a disconnect function.
 */
export function connectWebSocket(office, url, { onStatus = () => {}, maxBackoff = 15000 } = {}) {
  let ws, closed = false, backoff = 1000, timer;
  const open = () => {
    onStatus("connecting");
    ws = new WebSocket(url);
    ws.onopen = () => { backoff = 1000; onStatus("connected"); };
    ws.onmessage = (m) => {
      let data; try { data = JSON.parse(m.data); } catch { return console.warn("bad event", m.data); }
      (Array.isArray(data) ? data : [data]).forEach(ev => office.dispatch(ev));
    };
    ws.onclose = () => { if (closed) return; onStatus("disconnected"); timer = setTimeout(open, backoff); backoff = Math.min(maxBackoff, backoff * 2); };
    ws.onerror = () => ws.close();
  };
  open();
  return () => { closed = true; clearTimeout(timer); ws && ws.close(); onStatus("closed"); };
}

/** Same schema over Server-Sent Events (one JSON event per `data:` line). */
export function connectEventSource(office, url, { onStatus = () => {} } = {}) {
  const es = new EventSource(url);
  es.onopen = () => onStatus("connected");
  es.onmessage = (m) => { try { office.dispatch(JSON.parse(m.data)); } catch { /* ignore */ } };
  es.onerror = () => onStatus("disconnected");
  return () => { es.close(); onStatus("closed"); };
}

/** Scripted fake run so the office is alive without a backend. Returns a stop function. */
/**
 * @param {object} [o]
 * @param {Array<[who, message, to, warn?]>} [o.steps]  hand-off chain; `to` is an agent id or "review"
 * @param {object} [o.tail]  { waiting: [agent, msg], finishing: [agent, msg], done: msg }
 */
export function runDemo(office, { stepSecs = 7, handoffAt = 3, steps, tail, log = true } = {}) {
  const ids = office.agents.map(a => a.id), name = (id) => office.agents.find(a => a.id === id)?.name ?? id;
  const [a0, a1, a2, a3, a4, a5] = ids;
  steps ??= [
    [a0, "reading the description", a1], [a1, "writing the spec", a2], [a2, "listing parts", a3],
    [a3, "checking the design", a4, true], [a4, "fixing 2 problems", a3], [a3, "re-checking the design", a5],
    [a5, "writing the build guide", "review"],
  ].filter(s => s[0]);
  tail ??= { waiting: [a3 ?? a0, "waiting for approval"], finishing: [a5 ?? ids.at(-1), "finishing the build guide"], done: "Done — your design brief is ready" };
  const say = (m) => log && office.log(m);
  let t = 0, step = -1, pending;
  office.setTick((dt) => {
    t += dt;
    const s = Math.floor(t / stepSecs) % (steps.length + 4);
    if (s === step) return;
    step = s; clearTimeout(pending);
    office.reset();
    if (s < steps.length) {
      const [who, msg, to, warn] = steps[s];
      say(`${name(who)} is ${msg}`);
      office.dispatch({ type: "agent.state", agent: who, state: "typing", message: msg });
      pending = setTimeout(() => office.dispatch({ type: "agent.state", agent: who, state: "carry", to, warn, message: `taking ${warn ? "issues" : "output"} to ${to === "review" ? "review" : name(to)}` }), handoffAt * 1000);
    } else if (s === steps.length) { say(tail.waiting[1]); office.dispatch({ type: "agent.state", agent: tail.waiting[0], state: "waiting", message: tail.waiting[1] }); }
    else if (s === steps.length + 1) { say(tail.finishing[1]); office.dispatch({ type: "agent.state", agent: tail.finishing[0], state: "typing", message: tail.finishing[1] }); }
    else if (s === steps.length + 2) { say(tail.done); ids.forEach(id => office.dispatch({ type: "agent.state", agent: id, state: "done" })); }
    else say("New run starting");
  });
  return () => { clearTimeout(pending); office.setTick(null); office.reset(); };
}
