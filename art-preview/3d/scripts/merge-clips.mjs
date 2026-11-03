// Copy animation clips from one Meshy/Mixamo GLB onto others that share the mixamorig skeleton.
//   node merge-clips.mjs <source.glb> <clipName[=newName]>... -- <target.glb> <out.glb>
// Channels are matched by target node name; bones missing on the target are skipped.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const args = process.argv.slice(2), sep = args.indexOf("--");
const [src, ...clipArgs] = args.slice(0, sep), [tgt, out] = args.slice(sep + 1);
if (!src || !tgt || !out || !clipArgs.length) { console.error("usage: merge-clips.mjs <src> <clip[=rename]>... -- <target> <out>"); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const srcDoc = await io.read(src), doc = await io.read(tgt);
const root = doc.getRoot(), buffer = root.listBuffers()[0];
const nodesByName = new Map(root.listNodes().map(n => [n.getName(), n]));
const existing = new Set(root.listAnimations().map(a => a.getName()));

for (const arg of clipArgs) {
  const [from, to = from] = arg.split("=");
  const srcAnim = srcDoc.getRoot().listAnimations().find(a => a.getName() === from);
  if (!srcAnim) { console.error(`  clip "${from}" not found in ${src}`); process.exit(1); }
  if (existing.has(to)) { console.log(`  ${to}: already present, skipping`); continue; }
  const anim = doc.createAnimation(to), samplerMap = new Map();
  const copyAccessor = (a) => doc.createAccessor(a.getName()).setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer);
  let copied = 0, skipped = 0;
  for (const ch of srcAnim.listChannels()) {
    const node = nodesByName.get(ch.getTargetNode()?.getName());
    if (!node) { skipped++; continue; }
    const s = ch.getSampler();
    if (!samplerMap.has(s)) samplerMap.set(s, doc.createAnimationSampler().setInterpolation(s.getInterpolation()).setInput(copyAccessor(s.getInput())).setOutput(copyAccessor(s.getOutput())));
    anim.addSampler(samplerMap.get(s)).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(samplerMap.get(s)));
    copied++;
  }
  console.log(`  ${from}${to !== from ? " -> " + to : ""}: ${copied} channels copied${skipped ? `, ${skipped} skipped (bone missing)` : ""}`);
}
await io.write(out, doc);
