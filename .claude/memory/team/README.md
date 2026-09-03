# Team memory (local)

`.claude/memory/team/` holds project decisions and conventions for **this repo** that are worth surviving across sessions, distinct from the user-level auto-memory Claude Code already keeps globally (personal preferences/feedback, not project-specific facts).

**Git-versioned.** `.claude/` and `CLAUDE.md` are tracked in this repo's git history (as of 2026-09-03) so this knowledge base travels with the repo and is shared with every contributor using Claude Code, instead of living only on one machine. Treat this as a team-shared ADR log for the harness itself.

## Format

Each file: YAML frontmatter (`name`, `description`, `type: team`) + a short body. Same shape as the harness guide's memory convention (`docs/ai/guides/guia-construcao-harness.md` §5.1).

## Files

- [`harness-setup-decisions.md`](harness-setup-decisions.md) — decisions made while setting up this `.claude/` harness on 2026-09-03 and why.
