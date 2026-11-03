#!/usr/bin/env bash
# Build the web-ready character GLBs from the raw Meshy/Mixamo exports.
#   usage: scripts/build-chars.sh [SRC_DIR]
# Steps: copy the extra clips from the "(6)" export onto every character (merge-clips.mjs),
#        then compress (meshopt geometry + 1024px WebP textures) into assets/custom/<role>.glb
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-$HOME/Desktop/PersonalSite,/MeshyModels}"
OUT="assets/custom"
BASE="Meshy_AI_Stylized_3D_cartoon_office_worker_Pixar_20261103_animated_mixamo_All_animation"
TMP="$(mktemp -d)"
mkdir -p "$OUT"
[ -d scripts/node_modules ] || (cd scripts && npm i --silent)

# Critic re-exported with 3 more clips; the unnamed one is Mixamo "Typing"
CLIP_SRC="$SRC/$BASE (6).glb"
CLIPS=("_01a1a1ca_7b75_745b_8300_6c7ba2782fab=Typing" "Chair_Sit_Idle_M" "Finger_Wag_No")

# raw export suffix -> role (identified by outfit colors in each texture atlas)
declare -a MAP=(
  "::critic"          # red cardigan, grey hair, glasses
  " (1)::designer"    # purple hoodie
  " (2)::parts-buyer" # orange vest, red cap
  " (3)::reviser"     # green shirt
  " (4)::report-writer" # light blue shirt, tie
  " (5)::intake"      # teal blouse, headset
)

for entry in "${MAP[@]}"; do
  suffix="${entry%%::*}"; role="${entry##*::}"
  in="$SRC/$BASE$suffix.glb"; merged="$TMP/$role.glb"; out="$OUT/$role.glb"
  echo "→ $role"
  node scripts/merge-clips.mjs "$CLIP_SRC" "${CLIPS[@]}" -- "$in" "$merged"
  npx -y @gltf-transform/cli@4.5.1 optimize "$merged" "$out" \
    --compress meshopt --texture-compress webp --texture-size 1024 --no-simplify > /dev/null
done
rm -rf "$TMP"
ls -la "$OUT"
