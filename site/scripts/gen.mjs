// Renders every page from src/data + src/render into pages/ (Vite's root). Run before dev/build.
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allPages } from "../src/render/pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "pages");
rmSync(root, { recursive: true, force: true });
const pages = allPages();
const stripe = process.env.VITE_STRIPE_LINK || "/contact/?interest=Character%20pack";
for (const [path, html] of Object.entries(pages)) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html.replace(/%%STRIPE_LINK%%/g, stripe));
}
// pages/ is Vite's root; expose src/ inside it so every page can load /src/main.js
symlinkSync("../src", join(root, "src"), "dir");
console.log(`generated ${Object.keys(pages).length} pages -> pages/`);
