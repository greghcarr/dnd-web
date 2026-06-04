import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The engine lives in a sibling repo and is consumed directly from its
// TypeScript source (not its built dist). Aliasing to source means any
// engine edit hot-reloads here with no rebuild step, so dnd-web always
// runs the live engine version. This mirrors how the engine's own demo
// wires its dev mode (see ../dnd-srd-engine/vite.web.config.ts).
const ENGINE_ROOT = resolve(__dirname, '../dnd-srd-engine');

export default defineConfig({
  resolve: {
    alias: [
      // Most specific subpath first so the bare-name rule doesn't shadow it.
      { find: /^dnd-srd-engine\/starter-pack$/, replacement: resolve(ENGINE_ROOT, 'src/starter-pack.ts') },
      { find: /^dnd-srd-engine$/, replacement: resolve(ENGINE_ROOT, 'src/index.ts') },
      // The fuzz battle generator is not part of the engine's package
      // exports, so it is imported straight from the engine's scripts/.
      { find: /^@engine-fuzz$/, replacement: resolve(ENGINE_ROOT, 'scripts/combat-fuzz-core.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  server: {
    port: 5174,
    strictPort: false,
    // Vite forbids serving files outside the project root by default;
    // the engine source is a sibling directory, so allow-list it.
    fs: { allow: [resolve(__dirname), ENGINE_ROOT] },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
