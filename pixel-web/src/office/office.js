import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { buildRoom, buildFurniture } from "./room.js";
import { makeActor, routeTo } from "./actors.js";

export const DEFAULT_AGENTS = [
  { id: "intake",        name: "Intake",        model: "intake" },
  { id: "designer",      name: "Designer",      model: "designer" },
  { id: "parts-buyer",   name: "Parts Buyer",   model: "parts-buyer" },
  { id: "critic",        name: "Critic",        model: "critic" },
  { id: "reviser",       name: "Reviser",       model: "reviser" },
  { id: "report-writer", name: "Report Writer", model: "report-writer" },
];
export const STATES = ["idle", "typing", "walk", "carry", "waiting", "done", "failed"];
const DEFAULT_MSG = { idle: "idle", typing: "working", walk: "stretching legs", carry: "handing off", waiting: "waiting for approval", done: "done", failed: "failed" };

function makeLayout(count, cols = 3) {
  const SX = 1.8, RZ = 2.4, rows = Math.ceil(count / cols);
  const deskPos = (i) => ({ x: (i % cols) * SX, z: Math.floor(i / cols) * RZ });
  const midX = ((Math.min(cols, count) - 1) * SX) / 2;
  const REVIEW = { x: midX, z: (rows - 1) * RZ + 2.6 };
  const ROOM = { x0: -1.4, x1: (Math.min(cols, count) - 1) * SX + 1.4, z0: -1.3, z1: REVIEW.z + 1.6 };
  return { SX, RZ, cols, rows, count, deskPos, REVIEW, ROOM, center: new THREE.Vector3(midX, 0.5, (rows - 1) * RZ * 0.6) };
}

/**
 * Mount the office into a container element.
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string}  [opts.modelsBase="/models/"]  URL prefix for <agent>.glb and furniture/<name>.glb
 * @param {Array}   [opts.agents=DEFAULT_AGENTS]   roster: { id, name, model }
 * @param {boolean} [opts.controls=true]           allow orbit/zoom
 * @param {boolean} [opts.labels=true]             show name/activity labels over heads
 * @param {(msg:string)=>void} [opts.onLog]        receives human-readable log lines
 */
export function createOffice(container, opts = {}) {
  const modelsBase = opts.modelsBase ?? "/models/";
  const agents = opts.agents ?? DEFAULT_AGENTS;
  const layout = makeLayout(agents.length, opts.cols ?? 3);
  const onLog = opts.onLog ?? (() => {});

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.transparent });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (!opts.transparent) scene.background = new THREE.Color(opts.background ?? 0x1b1d24);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(layout.center.x + 0.4, 5.2, layout.REVIEW.z + 4.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(layout.center); controls.maxPolarAngle = Math.PI / 2.1; controls.enabled = opts.controls !== false; controls.update();
  scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x3a3d45, 1.0));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.8); sun.position.set(-4, 9, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe3ff, 0.5); fill.position.set(6, 4, -3); scene.add(fill);

  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  const load = (url) => cache.get(url) || cache.set(url, loader.loadAsync(url)).get(url);

  const chars = [], byId = new Map();
  const log = (msg) => onLog(msg);

  function setState(agentId, state, extra = {}) {
    const ch = typeof agentId === "object" ? agentId : byId.get(agentId);
    if (!ch) return console.warn("unknown agent", agentId);
    if (!STATES.includes(state)) return console.warn("unknown state", state);
    if (ch.state === state && !extra.force && !extra.message) return;
    ch.state = state; ch.holdBox(false);
    ch.setLabel(extra.message ?? DEFAULT_MSG[state], state);
    switch (state) {
      case "idle": ch.sitAtDesk("sit"); ch.setBubble(null); break;
      case "typing": ch.sitAtDesk("type"); ch.setBubble("work"); break;
      case "walk": { const s = ch.standSpot(); ch.standAtDesk(); ch.walkTo(s.x, s.z + 1.2, "walk", () => ch.walkTo(s.x, s.z, "walk", () => setState(ch, "walk", { force: true }))); ch.setBubble(null); break; }
      case "carry": {
        const toCh = extra.to && extra.to !== "review" ? byId.get(extra.to) : null;
        const target = extra.to === "review" ? { review: true } : toCh ? { x: toCh.deskX, z: toCh.deskZ } : layout.deskPos((chars.indexOf(ch) + 1) % chars.length);
        const toName = extra.to === "review" ? "review" : toCh?.agent.name;
        const { pts, face } = routeTo(ch, target, layout);
        ch.standAtDesk(); ch.setBubble(extra.warn ? "warn" : null); ch.holdBox(true);
        ch.walkPath(pts, "carry", () => {
          ch.g.rotation.y = face; ch.setBubble(null); ch.play("stand"); ch.holdBox(false);
          ch.setLabel(toName ? `handed off to ${toName}` : "handed off", "carry");
          setTimeout(() => {
            if (ch.state !== "carry") return;
            ch.setLabel("back to desk", "walk");
            const back = pts.slice(0, -1).reverse(); back.push([ch.standSpot().x, ch.standSpot().z]);
            ch.walkPath(back, "walk", () => { if (ch.state === "carry") setState(ch, "idle"); });
          }, 900);
        });
        break;
      }
      case "waiting": ch.tween = null; ch.g.position.set(layout.REVIEW.x, 0, layout.REVIEW.z - 0.8); ch.g.rotation.y = 0; ch.play("stand"); ch.setBubble("ask"); break;
      case "done": ch.standAtDesk(); ch.g.rotation.y = 0; ch.play("cheer"); ch.setBubble("done"); break;
      case "failed": ch.standAtDesk(); ch.g.rotation.y = 0; ch.play("no"); ch.setBubble("failed"); break;
    }
  }

  const clock = new THREE.Clock();
  let raf = 0, disposed = false, tick = null, paused = false;
  const ticks = new Set();
  function animate() {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    if (paused) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    tick && tick(dt);
    ticks.forEach(fn => fn(dt));
    for (const ch of chars) ch.update(dt);
    controls.update(); renderer.render(scene, camera);
  }
  // pause rendering while off-screen
  const io = new IntersectionObserver(([e]) => { paused = !e.isIntersecting; }); io.observe(container);

  const ready = (async () => {
    buildRoom(scene, layout);
    const [actors] = await Promise.all([Promise.all(agents.map((a, i) => makeActor(scene, a, i, layout, load, modelsBase, { labels: opts.labels !== false }))), buildFurniture(scene, layout, load, modelsBase)]);
    for (const ch of actors) { chars.push(ch); byId.set(ch.agent.id, ch); ch.sitAtDesk(); }
    animate(); log("Office ready");
    return office;
  })();

  const office = {
    ready, scene, camera, controls, renderer, agents, layout,
    setState, log,
    reset: () => chars.forEach(c => setState(c, "idle", { force: true })),
    /** apply a backend event: { type:"agent.state", agent, state, message?, to?, warn? } | { type:"run.log", message } | { type:"run.reset" } */
    dispatch(ev) {
      if (!ev || typeof ev !== "object") return;
      if (ev.type === "agent.state") setState(ev.agent, ev.state, { message: ev.message, to: ev.to, warn: ev.warn, force: ev.force });
      else if (ev.type === "run.log") log(ev.message);
      else if (ev.type === "run.reset") office.reset();
    },
    /** per-frame hook (used by the demo script) */
    setTick: (fn) => { tick = fn; },
    /** additional per-frame hooks; returns a remover */
    addTick: (fn) => { ticks.add(fn); return () => ticks.delete(fn); },
    /** world position of an agent (or its desk) */
    positionOf: (id) => { const ch = byId.get(id); return ch ? ch.g.position.clone() : null; },
    deskOf: (id) => { const ch = byId.get(id); return ch ? new THREE.Vector3(ch.deskX, 0, ch.deskZ) : null; },
    snapshot: () => chars.map(c => ({ agent: c.agent.id, state: c.state, message: c.message })),
    dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
  return office;
}
