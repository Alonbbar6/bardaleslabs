import { defineConfig } from "vite";
import { resolve } from "node:path";

// Library build: `import { createOffice } from "@bardaleslabs/pixel-office"` (three is a peer dependency)
export default defineConfig({
  build: {
    outDir: "dist-lib",
    lib: { entry: resolve(__dirname, "src/office/index.js"), formats: ["es"], fileName: "pixel-office" },
    rollupOptions: { external: [/^three/] },
  },
});
