// Tiny WebSocket server that emits the same scripted run as the in-page demo.
// Use it to test the "Connect live" path:  npm run mock:ws  ->  ws://localhost:8787
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8787;
const wss = new WebSocketServer({ port: PORT });
const send = (ev) => wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(ev)));
const steps = [
  ["intake", "reading the description", "designer"], ["designer", "writing the spec", "parts-buyer"], ["parts-buyer", "listing parts", "critic"],
  ["critic", "checking the design", "reviser", true], ["reviser", "fixing 2 problems", "critic"], ["critic", "re-checking the design", "report-writer"],
  ["report-writer", "writing the build guide", "review"],
];
let i = 0;
setInterval(() => {
  send({ type: "run.reset" });
  const s = i % (steps.length + 3);
  if (s < steps.length) {
    const [agent, message, to, warn] = steps[s];
    send({ type: "run.log", message: `${agent} is ${message}` });
    send({ type: "agent.state", agent, state: "typing", message });
    setTimeout(() => send({ type: "agent.state", agent, state: "carry", to, warn, message: `taking output to ${to}` }), 3000);
  } else if (s === steps.length) send({ type: "agent.state", agent: "critic", state: "waiting", message: "waiting for approval" });
  else if (s === steps.length + 1) send({ type: "agent.state", agent: "report-writer", state: "typing", message: "finishing the build guide" });
  else ["intake", "designer", "parts-buyer", "critic", "reviser", "report-writer"].forEach(agent => send({ type: "agent.state", agent, state: "done" }));
  i++;
}, 7000);
console.log(`mock agent events on ws://localhost:${PORT}`);
