---
name: harness-setup-decisions
description: Decisions and deviations made when setting up the .claude/ harness for this repo, following docs/ai/guides/guia-construcao-harness.md
type: team
---

### Facts

- `docs/ai/guides/guia-construcao-harness.md` describes a generic Python/FastAPI/Alembic dual-harness (Claude Code + Gemini CLI). This repo is a Bun/TypeScript CLI with no Python code, no Alembic, and Claude Code only was requested — commands and blueprints were adapted, not copy-pasted.
- `.gitignore` originally ignored `/.claude` and `CLAUDE.md` at repo root, deliberately (openclaude is explicitly provider-agnostic — see `package.json` description: "opens coding-agent workflows to any LLM"). The harness was initially kept local-only rather than un-ignoring it, per user decision (2026-09-03).
- **Reversed on 2026-09-03**: user asked to version `.claude/` (and `CLAUDE.md` + the team memory in `.claude/memory/team/` along with it). Both entries were removed from `.gitignore`; the harness (hooks, agents, skills, this memory) is now tracked in git and shared with any contributor using Claude Code.
- No `eslint`/`prettier` dependency or config exists locally; `.trunk/trunk.yaml` is a locally opt-in linter config that CI (`pr-checks.yml`) does not run. The zero-turn format hook (`.claude/format-on-edit.sh`) only runs `trunk fmt` if the `trunk` binary happens to be installed — silent no-op otherwise.
- Versioning is automated via release-please (`release-please-config.json`, Conventional Commits) — a guide-style `verify-semver.sh` blocking hook was deliberately **not** added since it would duplicate/conflict with that automation.
- The real quality gate is `CONTRIBUTING.md § Validation` (build/typecheck/test/security-scan), operationalized as `.claude/skills/pre-push-validation/` and `.claude/agents/release-readiness-verifier.md` instead of a guide-style `make lint`.
- Graphify was installed in **soft mode** (no `--strict`) via the native `graphify install --platform claude --project` — not the guide's hand-rolled `hook-guard` blueprint, since the CLI now ships this integration directly.

- `graphify update src --no-cluster` in one shot reproducibly hangs on this repo (confirmed 4x, always at ~3200/3268 files with 2 of 12 workers pegged at 100% CPU indefinitely). **Root cause found via binary-search bisection** (copy each candidate's files into an isolated temp dir, run graphify on just that subset): it's a parser bug on two specific files, not a volume/race issue — every other file and every other directory, including the full 969-file `src/utils/` on its own, extracts cleanly. The two known-bad files (both added to `.graphifyignore`):
  - `src/constants/promptIdentity.test.ts` — multi-line `typeof import('./x.js').Y` type-only imports + `;({ x } = await import(...))` destructuring; nothing else unusual (209 lines, no giant regex/strings).
  - `src/entrypoints/cli.tsx` — culprit pattern not fully isolated further, same failure signature (single worker pegged at 100% CPU, never returns).
  - **Workaround used**: build one `graphify update <dir> --no-cluster --force` per top-level `src/*` directory (all 47 succeed once the two files above are ignored), then `graphify merge-graphs <all graph.json paths> --out graphify-out/graph.json`. Final graph: 38953 nodes, 90780 links (note: JSON schema is NetworkX node-link format — top-level key is `links`, not `edges`).
  - If a future `graphify update`/`extract` run on this repo hangs again (single worker at ~100% CPU, no log progress for minutes), bisect the same way: copy suspect files into an isolated temp dir with `cp` (not symlinks — graphify does not follow symlinks) and binary-search: `graphify update <tmpdir> --no-cluster --force` with a ~15-20s watchdog kill.
  - The merged graph goes stale as code changes; there's no single `graphify update src` that works to refresh it in one shot. Either re-run the per-directory-build-and-merge script (saved nowhere permanent — recreate from this description), or run `graphify update <dir>` for just the directories that changed and re-merge.

### How to apply

When extending this harness, keep adaptations grounded in this repo's actual tooling (`bun`, `tsc`, `bun test`, release-please) rather than the guide's Python-stack examples — the guide's *pillars* (structure) apply, its literal commands mostly don't.
