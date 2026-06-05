# Deploying to GitHub Pages

dnd-web deploys to GitHub Pages as a static site that is rebuilt against the latest engine. Because the engine is bundled from source at build time, the published site has no runtime dependency on the engine; "use the latest engine" means "rebuild against it," which the CI handles.

The workflow is [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml). It checks out dnd-web and `dnd-srd-engine` (branch `main`) side by side, installs both, runs `npm run build` (which bundles the engine and sets the Pages base path), and publishes `dist/`.

## One-time setup

1. **Create the dnd-web GitHub repo (public)** and push it. The deploy runs on pushes to `main`, so make `main` the default branch. With the two-branch model in [DEVELOPMENT.md](../DEVELOPMENT.md), you develop on `dev` and merge to `main` to release:
   ```
   git remote add origin https://github.com/<you>/dnd-web.git
   git push -u origin main
   git push origin dev
   ```
2. **Enable Pages**: Settings -> Pages -> Source = "GitHub Actions". (The workflow's `configure-pages` step also auto-enables it on first run.)
3. The site publishes at `https://<you>.github.io/dnd-web/`. The base path is derived automatically from the repo name, so this works without editing the config.

If your engine repo is not `greghcarr/dnd-srd-engine`, update the `repository:` field in the deploy workflow.

## Auto-rebuild when the engine changes

The deploy workflow listens for a `repository_dispatch` of type `engine-updated`. To fire it on every engine release, add a small workflow to the **engine** repo plus a token:

1. **Create a token** that can trigger dnd-web: a Personal Access Token with access to the dnd-web repo (classic `repo` scope, or fine-grained with Contents: Read and write on dnd-web).
2. In the **engine** repo, add it as an Actions secret named `DNDWEB_DISPATCH_TOKEN`.
3. Add this workflow to the engine repo at `.github/workflows/notify-dnd-web.yml`:
   ```yaml
   name: Notify dnd-web Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   jobs:
     notify:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger dnd-web rebuild
           run: |
             curl -fsS -X POST \
               -H "Authorization: Bearer ${{ secrets.DNDWEB_DISPATCH_TOKEN }}" \
               -H "Accept: application/vnd.github+json" \
               -H "X-GitHub-Api-Version: 2022-11-28" \
               https://api.github.com/repos/<you>/dnd-web/dispatches \
               -d '{"event_type":"engine-updated"}'
   ```
   Replace `<you>/dnd-web` with the dnd-web repo path.

Now any push to the engine's `main` rebuilds and redeploys the site against it.

## How rebuilds happen

- Push to dnd-web `main` (a change here).
- The engine repo pushing `main` (via the dispatch above).
- Manually: the deploy workflow's "Run workflow" button (`workflow_dispatch`).

## Caveats

- The site builds against **pushed** engine `main` only. Local, unpushed engine work, or work that is still on the engine's `dev` branch, will not appear until it lands on `main` and is pushed. (To track `dev` instead, change `ref: main` in the deploy workflow.)
- The build does not run typecheck; it trusts the build. Run `npm run typecheck` locally before pushing.
- This mirrors the engine's own demo deploy ([../dnd-srd-engine/.github/workflows/deploy-demo.yml](../../dnd-srd-engine/.github/workflows/deploy-demo.yml)).
