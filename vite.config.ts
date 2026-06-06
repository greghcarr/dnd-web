import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// The engine is consumed directly from its TypeScript source (not its
// built dist), so any engine edit hot-reloads here with no rebuild and the
// engine is bundled into the output at build time. Locally it is the
// sibling repo; in CI (GitHub Pages) the deploy workflow checks the engine
// out alongside dnd-web and DND_ENGINE_PATH points at it.
const ENGINE_ROOT = resolve(__dirname, process.env.DND_ENGINE_PATH ?? '../dnd-srd-engine');

// GitHub Pages serves a project site under /<repo>/, so the deploy
// workflow sets BASE_PATH to that. Defaults to '/' for local dev/build.
const BASE_PATH = process.env.BASE_PATH ?? '/';

// Build-time version indicator pieces. Read app name + version from this
// project's package.json, engine version from the sibling's package.json,
// engine HEAD short SHA from `git -C <engine> rev-parse`. The SHA falls
// back to 'unknown' when the engine sibling isn't a git checkout (e.g.
// an unpacked tarball). Surfaced in the UI's version-badge as
// `<appName> <appVersion> / engine <engineVersion> (<engineSha>)`.
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const appPkg = readJson(resolve(__dirname, 'package.json'));
const enginePkg = readJson(resolve(ENGINE_ROOT, 'package.json'));
let engineSha = 'unknown';
try {
  engineSha = execSync(`git -C "${ENGINE_ROOT}" rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
  // Append '+dirty' when the engine working tree has uncommitted SOURCE
  // changes. Catches the "I demoed a local build that secretly used
  // unpushed engine code" failure mode -- the deployed bundle ships the
  // engine's committed state, but the badge shows what's actually in THIS
  // bundle. package-lock.json is excluded: the deploy workflow runs
  // `npm install` in the freshly checked-out engine, which rewrites the
  // tracked lockfile, and that install churn is not real source dirtiness.
  const dirty = execSync(`git -C "${ENGINE_ROOT}" status --porcelain`, { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('package-lock.json'));
  if (dirty.length > 0) engineSha += '+dirty';
} catch {
  // engine isn't a git checkout; leave as 'unknown'
}

export default defineConfig({
  base: BASE_PATH,
  define: {
    __APP_NAME__: JSON.stringify(appPkg.name),
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __ENGINE_VERSION__: JSON.stringify(enginePkg.version),
    __ENGINE_SHA__: JSON.stringify(engineSha),
  },
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
