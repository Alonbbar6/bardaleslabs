import * as THREE from "three";

// ---------- procedural textures (modern office: carpet tiles, concrete walls) ----------
export function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}
export function noise(g, size, alpha, n = 4000) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},${alpha})`; g.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
}
// 2x2 carpet tiles per texture, each tile 0.5 m -> texture covers 1 m
const carpetTex = (w, d) => canvasTex(512, (g, s) => {
  const half = s / 2, shades = ["#575b63", "#5c6068", "#53575f", "#595d65"];
  for (let i = 0; i < 4; i++) { g.fillStyle = shades[i]; g.fillRect((i % 2) * half, Math.floor(i / 2) * half, half, half); }
  for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.fillRect(0, y, s, 1); }
  noise(g, s, 0.08, 9000);
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2;
  for (const [x, y] of [[1, 1], [half + 1, 1], [1, half + 1], [half + 1, half + 1]]) g.strokeRect(x, y, half - 2, half - 2);
}, [w, d]);
const concreteTex = (w, h) => canvasTex(512, (g, s) => {
  g.fillStyle = "#d8d8d3"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${170 + Math.random() * 40 | 0},${170 + Math.random() * 40 | 0},${165 + Math.random() * 40 | 0},.05)`; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 40 + Math.random() * 120, 20 + Math.random() * 60, Math.random() * 3, 0, 7); g.fill(); }
  noise(g, s, 0.06, 16000);
  g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(24 + i * (s - 48), 24 + j * (s - 48), 5, 0, 7); g.fill(); }
}, [w, h]);

export const deskMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.85, metalness: 0.0 });
export const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6 });
export const DESK_H = 0.6;

export function buildRoom(scene, layout) {
  const { ROOM, SX, RZ } = layout;
  const w = ROOM.x1 - ROOM.x0, d = ROOM.z1 - ROOM.z0, cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2, H = 2.8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: carpetTex(w, d), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; scene.add(floor);
  const wallMat = (len) => new THREE.MeshStandardMaterial({ map: concreteTex(len / H, 1.0), roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, H, 0.12), wallMat(w)); back.position.set(cx, H / 2, ROOM.z0 - 0.06); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, d), wallMat(d)); left.position.set(ROOM.x0 - 0.06, H / 2, cz); left.receiveShadow = true; scene.add(left);
  for (const [geo, pos] of [[new THREE.BoxGeometry(w, 0.08, 0.03), [cx, 0.04, ROOM.z0 + 0.015]], [new THREE.BoxGeometry(0.03, 0.08, d), [ROOM.x0 + 0.015, 0.04, cz]]]) { const m = new THREE.Mesh(geo, darkMat); m.position.set(...pos); scene.add(m); }
  for (const wx of [SX - 1.5, SX + 1.5]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.06), darkMat); frame.position.set(wx, 1.7, ROOM.z0 + 0.02); scene.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.96), new THREE.MeshStandardMaterial({ color: 0xbfd9f2, emissive: 0x9cc4ea, emissiveIntensity: 0.6, roughness: 0.2 })); glass.position.set(wx, 1.7, ROOM.z0 + 0.06); scene.add(glass);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.96, 0.02), darkMat); mullion.position.set(wx, 1.7, ROOM.z0 + 0.07); scene.add(mullion);
  }
  void RZ;
}

// Normalize a loaded prop to a target height, feet on the floor, centered on x/z.
export function normalize(obj, target, axis = "y") {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const s = target / size[axis]; obj.scale.setScalar(s);
  box.setFromObject(obj); obj.position.y -= box.min.y;
  const c = box.getCenter(new THREE.Vector3()); obj.position.x -= c.x; obj.position.z -= c.z;
  const g = new THREE.Group(); g.add(obj);
  obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

export async function buildFurniture(scene, layout, load, modelsBase) {
  const { ROOM, SX, RZ, REVIEW, deskPos, count } = layout;
  const prop = async (name, size, x, z, ry = 0, mat = null, y = 0) => {
    const g = normalize((await load(`${modelsBase}furniture/${name}.glb`)).scene.clone(), size);
    if (mat) g.traverse(m => { if (m.isMesh) m.material = mat; });
    g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g;
  };
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = deskPos(i);
    jobs.push(prop("desk", DESK_H, x, z, Math.PI, deskMat), prop("chairDesk", 0.75, x, z - 0.6, 0, darkMat),
      prop("computerScreen", 0.32, x, z + 0.12, Math.PI, null, DESK_H), prop("computerKeyboard", 0.03, x, z - 0.15, Math.PI, null, DESK_H));
  }
  jobs.push(prop("plantSmall2", 0.5, ROOM.x0 + 0.5, RZ + 0.2), prop("tableRound", 0.6, REVIEW.x, REVIEW.z, 0, deskMat),
    prop("books", 0.08, REVIEW.x, REVIEW.z + 0.02, 0.4, null, DESK_H), prop("lampRoundFloor", 1.3, ROOM.x1 - 0.5, REVIEW.z - 0.4),
    prop("pottedPlant", 0.9, ROOM.x0 + 0.5, ROOM.z0 + 0.5), prop("bookcaseOpen", 1.4, ROOM.x1 - 0.6, ROOM.z0 + 0.3, 0),
    prop("kitchenCoffeeMachine", 0.35, ROOM.x1 - 0.5, RZ + 0.3));
  void SX;
  await Promise.all(jobs);
}
