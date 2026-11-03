// Wireframe network that grows as you scroll. Procedural: small rectangle "nodes" wired with
// right-angle elbow links, drawn in order of distance from the centre so a single drawRange = progress.
import * as THREE from "three";

const rand = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function elbow(a, b, r = 0.18, out = []) {
  // a -> corner (b.x, a.y, a.z) -> b, with rounded corners, as consecutive points
  const c1 = new THREE.Vector3(b.x, a.y, a.z), c2 = new THREE.Vector3(b.x, b.y, a.z);
  const pts = [a.clone()];
  const bend = (p, q, s) => { // rounded corner at q between p->q->s
    const d1 = q.clone().sub(p).normalize().multiplyScalar(-Math.min(r, p.distanceTo(q) / 2)), d2 = s.clone().sub(q).normalize().multiplyScalar(Math.min(r, q.distanceTo(s) / 2));
    const curve = new THREE.QuadraticBezierCurve3(q.clone().add(d1), q.clone(), q.clone().add(d2));
    pts.push(...curve.getPoints(6));
  };
  bend(a, c1, c2); bend(c1, c2, b); pts.push(b.clone());
  for (let i = 0; i < pts.length - 1; i++) out.push(pts[i], pts[i + 1]);
  return out;
}

export function createNetwork(canvas, { count = 110, seed = 7, color = 0xffffff, poster } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const rig = new THREE.Group(); scene.add(rig);

  // nodes
  const R = rand(seed), nodes = [];
  for (let i = 0; i < count; i++) {
    const x = (R() - 0.5) * 13, y = (R() - 0.5) * 4.2, z = (R() - 0.5) * 6;
    nodes.push({ p: new THREE.Vector3(Math.round(x * 2) / 2, Math.round(y * 4) / 4, Math.round(z * 2) / 2), w: 0.34 + R() * 0.3, h: 0.16 + R() * 0.1 });
  }
  nodes.sort((a, b) => a.p.length() - b.p.length());
  // edges: each node links to 1-2 earlier (closer-to-centre) nodes so the graph grows outward
  const segs = [], nodeSegs = [], order = [];
  const push = (arr, pts) => { for (const p of pts) arr.push(p.x, p.y, p.z); };
  nodes.forEach((n, i) => {
    const rect = [];
    const hw = n.w / 2, hh = n.h / 2, c = n.p;
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => new THREE.Vector3(c.x + dx, c.y + dy, c.z));
    for (let k = 0; k < 4; k++) rect.push(corners[k], corners[(k + 1) % 4]);
    const linkPts = [];
    if (i > 0) {
      const links = i < 6 ? 1 : 1 + (R() < 0.35 ? 1 : 0);
      const pool = nodes.slice(Math.max(0, i - 14), i);
      for (let l = 0; l < links; l++) { const t = pool[Math.floor(R() * pool.length)]; elbow(n.p, t.p, 0.2, linkPts); }
    }
    order.push({ rectStart: nodeSegs.length / 3, linkStart: segs.length / 3 });
    push(nodeSegs, rect); push(segs, linkPts);
  });
  const mkLines = (arr, opacity) => {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.LineSegments(g, m); rig.add(l); return l;
  };
  const rects = mkLines(nodeSegs, 0.9), links = mkLines(segs, 0.45);
  // glowing dots at node centres
  const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodes.flatMap(n => [n.p.x, n.p.y, n.p.z]), 3));
  const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0x6ea0ff, size: 0.06, transparent: true, opacity: 0.9, sizeAttenuation: true })); rig.add(dots);
  // central image plane (the product)
  if (poster) {
    const tex = new THREE.TextureLoader().load(poster); tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 }));
    plane.position.set(0, 0, 0.01); rig.add(plane);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.7, 1.0)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })); frame.position.copy(plane.position); rig.add(frame);
  }

  let progress = 0, mouse = { x: 0, y: 0 }, raf = 0, visible = true, disposed = false;
  const setProgress = (p) => {
    progress = THREE.MathUtils.clamp(p, 0, 1);
    const n = Math.max(3, Math.floor(progress * nodes.length));
    const o = order[Math.min(n, order.length - 1)];
    rects.geometry.setDrawRange(0, n >= nodes.length ? Infinity : o.rectStart);
    links.geometry.setDrawRange(0, n >= nodes.length ? Infinity : o.linkStart);
    dots.geometry.setDrawRange(0, n);
  };
  const resize = () => { const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const onMove = (e) => { mouse.x = (e.clientX / innerWidth - 0.5) * 2; mouse.y = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener("pointermove", onMove, { passive: true });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);

  const frame = (t) => {
    if (disposed) return; raf = requestAnimationFrame(frame);
    if (!visible) return;
    const a = -0.55 + progress * 0.35 + mouse.x * 0.08, e = 0.42 - progress * 0.1 + mouse.y * 0.05, d = 12.5 - progress * 1.2;
    camera.position.set(Math.sin(a) * d * Math.cos(e), Math.sin(e) * d, Math.cos(a) * d * Math.cos(e)); camera.lookAt(0, 0, 0);
    rig.rotation.y = Math.sin(t / 9000) * 0.04;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  setProgress(0.08);
  return { setProgress, dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener("pointermove", onMove); renderer.dispose(); } };
}
