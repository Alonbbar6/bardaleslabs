import * as THREE from "three";
import { canvasTex, noise, normalize } from "./room.js";

// scene action -> Mixamo clip name baked into every character GLB
export const ANIM = { sit: "Chair_Sit_Idle_M", type: "Typing", walk: "Walking", carry: "Carry_Heavy_Object_Walk", stand: "Idle_3", cheer: "Cheer_with_Both_Hands", no: "Finger_Wag_No" };
export const CHAR_HEIGHT = 1.3, SIT_DZ = -0.5;
// units/sec per locomotion clip, tuned so feet don't slide at CHAR_HEIGHT
const SPEED = { walk: 1.0, carry: 0.75 };
export const ACCENT = { idle: "#6b7280", typing: "#f2c94c", carry: "#3f7bd9", walk: "#3f7bd9", waiting: "#a855f7", done: "#2fb85a", failed: "#d9342b" };

function makeSprite(text, bg, fg = "#fff") {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, 240, 92, 24); g.fill();
  g.beginPath(); g.moveTo(112, 100); g.lineTo(144, 100); g.lineTo(128, 124); g.fill();
  g.fillStyle = fg; g.font = "bold 44px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 56);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // constant screen size so bubbles near the camera don't balloon
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
  sp.scale.set(0.11, 0.055, 1); sp.renderOrder = 10; return sp;
}
const BUBBLES = { ask: () => makeSprite("?", "#3f7bd9"), warn: () => makeSprite("!", "#d9342b"), done: () => makeSprite("✓", "#2fb85a"), failed: () => makeSprite("✕", "#d9342b"), work: () => makeSprite("…", "#f4f4ee", "#333") };

// Name + activity label that floats over each character's head
function makeLabel() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 160;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
  sp.scale.set(0.22, 0.069, 1); sp.renderOrder = 9;
  sp.set = (name, activity, accent = "#9aa3b2") => {
    const g = c.getContext("2d"); g.clearRect(0, 0, 512, 160);
    g.fillStyle = "rgba(20,22,30,.82)"; g.beginPath(); g.roundRect(16, 16, 480, 128, 22); g.fill();
    g.fillStyle = accent; g.fillRect(16, 16, 10, 128);
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillStyle = "#fff"; g.font = "bold 46px system-ui"; g.fillText(name, 48, 58);
    g.fillStyle = "#c7cdd8"; g.font = "36px system-ui"; g.fillText(activity, 48, 110, 430);
    tex.needsUpdate = true;
  };
  return sp;
}

// Cardboard box carried during hand-offs; positioned between the hands every frame
let boxTex;
function makeBox() {
  boxTex ??= canvasTex(256, (g, s) => {
    g.fillStyle = "#c9a26b"; g.fillRect(0, 0, s, s); noise(g, s, 0.06, 3000);
    g.fillStyle = "#e8dcc0"; g.fillRect(s * 0.42, 0, s * 0.16, s);
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 3; g.strokeRect(2, 2, s - 4, s - 4);
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.26), new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.9 }));
  box.castShadow = true; box.visible = false; return box;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export async function makeActor(scene, agent, i, layout, load, modelsBase, { labels = true } = {}) {
  const gltf = await load(`${modelsBase}${agent.model}.glb`);
  const model = gltf.scene;
  const g = normalize(model, CHAR_HEIGHT);
  model.traverse(m => { if (m.isSkinnedMesh) m.frustumCulled = false; });
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(gltf.animations.map(a => [a.name, mixer.clipAction(a, model)]));
  const { x: deskX, z: deskZ } = layout.deskPos(i);
  const ch = { agent, g, model, mixer, clips, current: null, deskX, deskZ, bubble: null, tween: null, state: "", anim: "", message: "" };

  ch.label = makeLabel(); ch.label.position.set(0, CHAR_HEIGHT + 0.25, 0); ch.label.visible = labels; g.add(ch.label);
  ch.setLabel = (activity, state) => { ch.message = activity; ch.label.set(agent.name, activity, ACCENT[state] ?? ACCENT.idle); };
  ch.box = makeBox(); scene.add(ch.box);
  // GLTFLoader strips ":" from node names, so "mixamorig:LeftHand" becomes "mixamorigLeftHand"
  const bone = (n) => { let hit = null; model.traverse(o => { if (!hit && o.name.replace(/[:_]/g, "").endsWith(n)) hit = o; }); return hit; };
  ch.hands = [bone("LeftHand"), bone("RightHand")];
  ch.holdBox = (on) => { ch.box.visible = on && !!ch.hands[0] && !!ch.hands[1]; };

  ch.play = (name, once = false) => {
    if (ch.anim === name) return;
    const a = clips[ANIM[name] ?? name]; if (!a) { console.warn(agent.name, "missing clip", name); return; }
    if (ch.current) ch.current.fadeOut(0.25);
    a.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
    a.clampWhenFinished = once; ch.current = a; ch.anim = name;
  };
  ch.setBubble = (kind) => {
    if (ch.bubble) { g.remove(ch.bubble); ch.bubble = null; }
    if (kind) { ch.bubble = BUBBLES[kind](); ch.bubble.position.set(0, CHAR_HEIGHT + 0.85, 0); g.add(ch.bubble); }
  };
  ch.sitAtDesk = (anim = "sit") => { ch.tween = null; g.position.set(deskX, 0, deskZ + SIT_DZ); g.rotation.y = 0; ch.play(anim); };
  ch.standSpot = () => new THREE.Vector3(deskX + 0.8, 0, deskZ + 0.4);
  ch.standAtDesk = () => { ch.tween = null; g.position.copy(ch.standSpot()); g.rotation.y = Math.PI / 2; };
  ch.walkTo = (x, z, anim, then) => {
    const from = g.position.clone(), to = new THREE.Vector3(x, 0, z), dist = from.distanceTo(to);
    if (dist < 0.05) { g.position.copy(to); then && then(); return; }
    g.position.y = 0; g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); ch.play(anim);
    ch.tween = { from, to, t: 0, dur: Math.max(0.3, dist / (SPEED[anim] ?? 1)), then };
  };
  ch.walkPath = (pts, anim, then) => { const [p, ...rest] = pts; if (!p) return then && then(); ch.walkTo(p[0], p[1], anim, () => ch.walkPath(rest, anim, then)); };
  ch.update = (dt) => {
    mixer.update(dt);
    if (ch.tween) {
      const tw = ch.tween; tw.t += dt / tw.dur;
      if (tw.t >= 1) { g.position.copy(tw.to); ch.tween = null; tw.then && tw.then(); }
      else g.position.lerpVectors(tw.from, tw.to, tw.t);
    }
    if (ch.box.visible) {
      g.updateMatrixWorld(true);
      ch.box.position.copy(ch.hands[0].getWorldPosition(_a)).add(ch.hands[1].getWorldPosition(_b)).multiplyScalar(0.5);
      ch.box.rotation.y = g.rotation.y;
    }
  };
  ch.setLabel("idle", "idle");
  scene.add(g);
  return ch;
}

// Route from a character's stand spot to a hand-off point: out to the aisle in front of its own row,
// along the aisle, down the gap beside the target column, then step in front of the receiver.
export function routeTo(ch, target, layout) {
  const s = ch.standSpot(), aisle = ch.deskZ + 0.9, { REVIEW } = layout;
  if (target.review) return { pts: [[s.x, aisle], [s.x, REVIEW.z - 0.8], [REVIEW.x, REVIEW.z - 0.8]], face: 0 };
  const gap = target.x + 0.9, hz = target.z + 0.9;
  return { pts: [[s.x, aisle], [gap, aisle], [gap, hz], [target.x, hz]], face: Math.PI };
}
