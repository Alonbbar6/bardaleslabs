# Pixel office — watch your agents at work

A 3D office where each AI agent is an animated character. Agents sit and type while working, carry a box
to the next desk when they hand off, wait at the round table for approval, cheer when a run finishes.
Drives from a WebSocket / SSE event stream, or a built-in demo run.

```
npm install
npm run dev          # http://localhost:5173  (landing page + live office)
npm run mock:ws      # ws://localhost:8787    (fake backend; paste into "Connect live")
npm run build        # dist/ (site: index.html + embed.html)  and  dist-lib/ (npm library)
npm run pack:models  # dist-pack/bardaleslabs-office-workers.zip (the $5 character pack)
```

## Pages
- `/` — BardalesLabs "Watch our agents at work" page: live office, roster, embed instructions, license store.
  `?ws=wss://…` or `VITE_AGENTS_WS` env connects it to a backend; otherwise the demo run plays.
- `/embed.html?ws=…&controls=0` — bare office for iframes. Without `ws` it plays the demo.
  Parent pages may also `iframe.contentWindow.postMessage(event, "*")`.

## Library (`src/office/`)
```js
import { createOffice, connectWebSocket, connectEventSource, runDemo } from "@bardaleslabs/pixel-office";

const office = createOffice(el, {
  modelsBase: "/models/",       // where <model>.glb and furniture/*.glb live (copy public/models)
  agents: DEFAULT_AGENTS,       // [{ id, name, model }], any count; 3 per row
  controls: true, onLog: console.log,
});
await office.ready;
office.dispatch({ type: "agent.state", agent: "designer", state: "typing", message: "writing the spec" });
office.setState("designer", "carry", { to: "critic", warn: true });
office.snapshot(); office.reset(); office.dispose();
```

### Event schema (one JSON object per WebSocket message; arrays accepted)
| event | fields |
|---|---|
| `agent.state` | `agent` (id), `state` (`idle` `typing` `carry` `walk` `waiting` `done` `failed`), `message?`, `to?` (agent id or `"review"`, for `carry`), `warn?` |
| `run.log` | `message` |
| `run.reset` | — (everyone back to idle) |

## Store
`VITE_STRIPE_LINK` — a Stripe Payment Link for the $5 character pack. Set the link's after-payment
redirect to wherever you host `dist-pack/bardaleslabs-office-workers.zip` (R2/S3 signed URL, Gumroad, etc.).
Without it the button falls back to a mailto. Terms: `LICENSE-MODELS.md`.

## Assets
Characters: Meshy AI + Mixamo clips, built by `../art-preview/3d/scripts/build-chars.sh` (see
`../art-preview/3d/ASSETS.md`). Furniture: Kenney.nl, CC0. Floor and walls are procedural canvas textures.
