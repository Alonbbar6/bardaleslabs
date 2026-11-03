# 3D asset provenance

## Characters (`assets/custom/*.glb`)
- Source: Meshy AI (paid plan, outputs owned), text-to-3D, generated 2026-11-03.
  Shared style line: "Stylized 3D cartoon office worker, Pixar-like smooth shading, simplified proportions, clean flat colors, T-pose, game-ready".
- Rig + clips: Meshy auto-rig (Mixamo-compatible `mixamorig:*` skeleton) + Meshy/Mixamo animation library.
- Raw exports live outside this repo (`~/Desktop/PersonalSite,/MeshyModels/`): six characters `..._All_animation[ (1-5)].glb`
  plus `(6).glb` = Critic re-exported with Typing / Chair_Sit_Idle_M / Finger_Wag_No.
- Build: `scripts/build-chars.sh` copies the three extra clips onto every character (`scripts/merge-clips.mjs`, matched by bone name)
  then compresses with gltf-transform (meshopt + 1024px WebP). ~6 MB -> ~0.85 MB each.
- Clips on every model: Running, Walking, Carry_Heavy_Object_Walk, Cheer_with_Both_Hands, Idle_3, Sitting_Answering_Questions, Typing, Chair_Sit_Idle_M, Finger_Wag_No.

| file | role | look |
|---|---|---|
| intake.glb | Intake | teal blouse, headset |
| designer.glb | Designer | purple hoodie, blond |
| parts-buyer.glb | Parts Buyer | orange vest, red cap |
| critic.glb | Critic | red cardigan, grey hair, glasses |
| reviser.glb | Reviser | green shirt |
| report-writer.glb | Report Writer | light blue shirt, tie |

## Furniture (`assets/furniture/`, `assets/chars/`)
- Kenney.nl Furniture Kit and Mini Characters, CC0. Desk/table/chair materials are overridden in code (matte white / charcoal).

## Room surfaces
- Carpet tiles and concrete walls are procedural canvas textures generated at runtime in `index.html` (no external files).
