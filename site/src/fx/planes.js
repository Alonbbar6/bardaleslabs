// Layered "glass" planes in Z. Each step brings one plane forward with its texture; the others
// fall back to a wireframe outline. Textures are drawn on canvases so there are no image assets.
import * as THREE from "three";

function roundedRectEdges(w, h, r) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const pts = s.getPoints(12), arr = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; arr.push(a.x, a.y, 0, b.x, b.y, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); return g;
}

export const drawers = {
  // SocialSnap queue
  socialsnap(g, W, H) {
    g.fillStyle = "#0f1116"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#9aa3b2"; g.font = "600 26px system-ui"; g.fillText("SocialSnap · posts.csv", 48, 64);
    g.fillStyle = "#6ea0ff"; g.font = "500 22px ui-monospace, Menlo"; g.textAlign = "right"; g.fillText("next run  Thu 9:00", W - 48, 64); g.textAlign = "left";
    const rows = [["Nov 05", "New: same-day delivery in Wynwood", "#2fb85a", "posted"], ["Nov 07", "Behind the counter", "#2fb85a", "posted"], ["Nov 09", "Reel · cold call #14", "#f2c94c", "queued"], ["Nov 11", "Three stylists, one question", "#f2c94c", "queued"], ["Nov 13", "Client story: Miami Market", "#9aa3b2", "draft"]];
    rows.forEach(([d, t, c, s], i) => { const y = 110 + i * 92; g.fillStyle = "#161a22"; g.beginPath(); g.roundRect(48, y, W - 96, 72, 14); g.fill(); g.fillStyle = "#9aa3b2"; g.font = "500 20px ui-monospace, Menlo"; g.fillText(d, 72, y + 44); g.fillStyle = "#eef0f4"; g.font = "500 24px system-ui"; g.fillText(t, 190, y + 45); g.fillStyle = c; g.font = "600 16px system-ui"; g.textAlign = "right"; g.fillText(s.toUpperCase(), W - 72, y + 44); g.textAlign = "left"; });
  },
  // lead-gen meeting brief
  leadgen(g, W, H) {
    g.fillStyle = "#0f1116"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#6ea0ff"; g.font = "600 20px system-ui"; g.fillText("MEETING BRIEF · THURSDAY 2:00 PM", 48, 60);
    g.fillStyle = "#eef0f4"; g.font = "600 40px system-ui"; g.fillText("Harbor Point Dental", 48, 120);
    g.fillStyle = "#9aa3b2"; g.font = "400 24px system-ui"; ["Who: Dr. Lena Ortiz, owner · 2 locations, Fort Lauderdale", "Why now: website down since Oct, 40+ reviews mention booking", "Said: \"We lose calls after 6pm. Can something answer them?\"", "Lead with: after-hours booking agent, live in two weeks"].forEach((l, i) => g.fillText(l, 48, 180 + i * 46));
    const tags = ["Researched", "Verified", "Outreach · day 1", "Reply · day 3", "Booked"]; let x = 48;
    tags.forEach((t, i) => { g.font = "600 18px system-ui"; const w = g.measureText(t).width + 36; g.fillStyle = i === 4 ? "#2fb85a" : "#1f2531"; g.beginPath(); g.roundRect(x, H - 110, w, 44, 22); g.fill(); g.fillStyle = i === 4 ? "#0b0d12" : "#c7cdd8"; g.fillText(t, x + 18, H - 81); x += w + 12; });
  },
  // agents at work: use the poster image drawn in
  agents(g, W, H, img) {
    g.fillStyle = "#0f1116"; g.fillRect(0, 0, W, H);
    if (img) g.drawImage(img, 0, 0, W, H);
    g.fillStyle = "rgba(11,13,18,.55)"; g.fillRect(0, H - 120, W, 120);
    g.fillStyle = "#eef0f4"; g.font = "600 30px system-ui"; g.fillText("Agents at work", 48, H - 66);
    g.fillStyle = "#9aa3b2"; g.font = "400 22px system-ui"; g.fillText("Researcher → Writer → QA → Outreach → Follow-up → Booker", 48, H - 30);
  },
};

export async function createPlanes(canvas, { steps, poster }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const rig = new THREE.Group(); scene.add(rig);
  const img = poster ? await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = poster; }) : null;

  const W = 1024, H = 640, PW = 3.2, PH = 2.0;
  const planes = steps.map((s, i) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H; drawers[s.draw](c.getContext("2d"), W, H, img);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.08, PH - 0.08), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 }));
    const edge = new THREE.LineSegments(roundedRectEdges(PW, PH, 0.18), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    const grp = new THREE.Group(); grp.add(fill, edge); grp.userData = { i, fill, edge }; rig.add(grp); return grp;
  });
  rig.rotation.set(0.12, -0.5, 0.02);

  let progress = 0, raf = 0, visible = true, disposed = false, mouse = { x: 0, y: 0 };
  const setProgress = (p) => { progress = THREE.MathUtils.clamp(p, 0, 1); };
  const resize = () => { const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const onMove = (e) => { mouse.x = (e.clientX / innerWidth - 0.5) * 2; mouse.y = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener("pointermove", onMove, { passive: true });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
  camera.position.set(0, 0.3, 7.2);

  const frame = () => {
    if (disposed) return; raf = requestAnimationFrame(frame);
    if (!visible) return;
    const n = steps.length, f = progress * (n - 1); // active plane index, fractional
    planes.forEach((g, i) => {
      const d = i - f; // negative = already passed (moves towards camera and fades), positive = waiting behind
      const target = d > 0 ? 1 - Math.min(1, Math.abs(d)) : 1 - Math.min(1, Math.abs(d) * 1.4);
      g.position.set(d * 0.55, -d * 0.12, -d * 1.3);
      g.userData.fill.material.opacity += (Math.max(0, target) - g.userData.fill.material.opacity) * 0.12;
      g.userData.edge.material.opacity = 0.2 + Math.max(0, target) * 0.7;
    });
    rig.rotation.y = -0.5 + mouse.x * 0.06 + progress * 0.25; rig.rotation.x = 0.12 + mouse.y * 0.04;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return { setProgress, dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener("pointermove", onMove); renderer.dispose(); } };
}
