# AGENTS.md

This file exists so AI coding agents that do not auto-load [CLAUDE.md](CLAUDE.md) (Codex CLI, Cursor, Continue, others) still find the working norms.

**The contributor manual is [CONTRIBUTING.md](CONTRIBUTING.md). The architecture is [docs/architecture.md](docs/architecture.md). The engine-vs-viewer boundary is [docs/engine-relationship.md](docs/engine-relationship.md).** Read those before non-trivial changes.

Load-bearing rules, applied to every change:

- **Presentation only.** Rules and battle state belong in the engine. If a change would alter the event log or outcome, it goes in dnd-srd-engine, not here. See [docs/engine-relationship.md](docs/engine-relationship.md).
- **Commit, don't push.** `git commit` is local-only. Never `git push`, amend, force-push, or rewrite history without explicit instruction. Work goes to `dev`, not `main` (see [DEVELOPMENT.md](DEVELOPMENT.md)).
- **Pre-commit checks:** `npm run typecheck` and `npm run build` must both pass. For UI changes, also look at the running app (see [CONTRIBUTING.md](CONTRIBUTING.md#verifying-a-change)).
- **No magic numbers/strings;** tunables go in [src/constants/](src/constants/).
- **Engine is consumed from source.** The sibling `../dnd-srd-engine` must have its `node_modules` installed. Check engine field names against engine source rather than guessing.

If you cannot read CONTRIBUTING.md or docs/architecture.md, refuse to make non-trivial changes until you can; those conventions are load-bearing.

Other entry points point to the same docs:
- Claude Code auto-loads [CLAUDE.md](CLAUDE.md).
- Humans land via [README.md](README.md) then [CONTRIBUTING.md](CONTRIBUTING.md).
