#!/usr/bin/env bash
# Build the sellable character pack: dist-pack/bardaleslabs-office-workers.zip
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="dist-pack"; NAME="bardaleslabs-office-workers"
rm -rf "$OUT/$NAME" && mkdir -p "$OUT/$NAME"
cp public/models/*.glb "$OUT/$NAME/"
cp LICENSE-MODELS.md "$OUT/$NAME/LICENSE.md"
cat > "$OUT/$NAME/README.md" <<'EOF'
# BardalesLabs office workers — character pack

Six stylized office workers (intake, designer, parts-buyer, critic, reviser, report-writer) as GLB files.

- Rig: Mixamo-compatible (`mixamorig:*` bones) — any Mixamo clip retargets directly.
- Clips in every file: Typing, Chair_Sit_Idle_M, Walking, Carry_Heavy_Object_Walk, Cheer_with_Both_Hands,
  Finger_Wag_No, Sitting_Answering_Questions, Idle_3, Running.
- Compression: EXT_meshopt_compression + WebP textures (1024px). three.js: `loader.setMeshoptDecoder(MeshoptDecoder)`.
  Blender 4.x, Unity (glTFast) and Godot import them directly.
- Height ~1.8 units at scale 1; the web viewer normalizes to 1.3.

See LICENSE.md for what you can do with them.
EOF
(cd "$OUT" && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME")
ls -la "$OUT/$NAME.zip"
