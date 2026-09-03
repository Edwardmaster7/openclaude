# CLAUDE.md

Claude Code harness for this repo. This file and `.claude/` are versioned in git so the harness (hooks, agents, skills, curated team memory) travels with the repo and is shared with every contributor who uses Claude Code — see `.claude/memory/team/harness-setup-decisions.md` for the history of this decision.

For stack, conventions, repository map, and the authoritative pre-push validation contract, see [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) — this file only adds Claude Code-specific harness notes.

## Commands Reference

- **Build**: `bun run build`
- **Dev**: `bun run dev`
- **Typecheck**: `bun run typecheck`
- **Tests**: `bun run test` (full: `bun run check`)
- **Full pre-push contract**: see [CONTRIBUTING.md § Validation](CONTRIBUTING.md#validation) — must be run before every push, not just `bun run check`.

## Formatting / Lint

No local eslint/prettier and CI doesn't run `trunk`; `.trunk/trunk.yaml` is a locally opt-in config, not enforced. The `PostToolUse` hook runs `trunk fmt` on edited files only if `trunk` is installed (silent no-op otherwise) — don't rely on it as a substitute for the real pre-push contract.

## Knowledge Graph (graphify)

Installed in soft mode (no `--strict`): reads are not blocked, but prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` to orient before broad `Grep`/`Glob` sweeps in this fairly large codebase (`src/`, `web/`, `scripts/`).

**Do not run `graphify update .` or `graphify update src` or `graphify extract .` directly on this repo — they reliably hang** (confirmed root cause: a parser bug on specific files, not scale; see `.claude/memory/team/harness-setup-decisions.md`). To rebuild the graph after code changes, run `.claude/rebuild-graph.sh` instead — it builds one subgraph per top-level `src/*` directory (working around the hang) and merges them with `graphify merge-graphs`. Files known to hang the parser standalone are listed in `.graphifyignore`.

## Skills

- Project skill: `.claude/skills/pre-push-validation/` — runs the CONTRIBUTING.md validation contract.
- Superpowers plugin skills are enabled globally (brainstorming, writing-plans, systematic-debugging, code-review, etc.) — see `using-superpowers`.

## Subagents

- `.claude/agents/release-readiness-verifier.md` — zero-context audit of the pre-push validation contract + CHANGELOG/docs hygiene before a PR/push.
- `.claude/agents/provider-integration-verifier.md` — zero-context audit of new/changed provider integrations against `src/integrations/` and `docs/integrations/` conventions.

## Memory

- `.claude/memory/team/` — curated project decisions/ADRs for this repo, versioned in git and shared across contributors.
- User-level auto-memory (preferences, feedback) is handled natively by Claude Code and lives outside this repo.

## Sandbox (ai-jail, optional)

`.ai-jail` at repo root isolates the `claude` CLI to this project directory plus the mapped tool/config dirs. Run via `ai-jail claude`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost). **Exception for this repo**: `graphify update .` (or `update src`) hangs — use `.claude/rebuild-graph.sh` instead, see the Knowledge Graph section above.
