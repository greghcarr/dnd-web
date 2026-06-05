import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The engine is consumed directly from its TypeScript source (not its
// built dist), so any engine edit hot-reloads here with no rebuild and the
// engine is bundled into the output at build time. Locally it is the
// sibling repo; in CI (GitHub Pages) the deploy workflow checks the engine
// out alongside dnd-web and DND_ENGINE_PATH points at it.
const ENGINE_ROOT = resolve(__dirname, process.env.DND_ENGINE_PATH ?? '../dnd-srd-engine');

// GitHub Pages serves a project site under /<repo>/, so the deploy
// workflow sets BASE_PATH to that. Defaults to '/' for local dev/build.
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: BASE_PATH,
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
