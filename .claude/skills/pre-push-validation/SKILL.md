---
name: pre-push-validation
description: Run the authoritative local pre-push validation contract for this repo before pushing to a PR or opening one. Use when the user asks to validate, check, or verify the branch is ready to push, or before creating a PR.
---

# Pre-Push Validation

## Context and goal

CONTRIBUTING.md § Validation is this repo's authoritative local pre-push contract — it covers the same command families as `.github/workflows/pr-checks.yml` and must be run before every push to an open PR, including follow-up pushes. This skill operationalizes that contract instead of re-deriving it from memory each time.

## Steps

1. Read `CONTRIBUTING.md`'s `## Validation` section now — it is the source of truth; do not rely on a cached copy of the commands.
2. If the repo is a shallow clone (`git rev-parse --is-shallow-repository` prints `true`), run `git fetch --unshallow` first (the security scan needs full ancestry to find the PR's merge base).
3. Run, in order, stopping to report (not silently continue past) any failure:
   - `bun install --frozen-lockfile`
   - `bun run check` (already runs build, smoke, deadcode, and the full unit pass — do not additionally run those separately)
   - `bun run typecheck`
   - `bun run typecheck:type-tests`
   - `node bin/openclaude --version`
   - `NODE_DISABLE_COMPILE_CACHE=1 node bin/openclaude --version`
   - `bun run test:provider`
   - `npm run test:provider-recommendation`
   - `git fetch https://github.com/Gitlawb/openclaude.git main` then `bun run security:pr-scan -- --base FETCH_HEAD --head HEAD`
4. If the diff touches `web/`, root or web dependency/lock files, shared site assets, or site build/toolchain config, also run:
   - `bun install --cwd web --frozen-lockfile`
   - `bun run web:typecheck`
   - `bun run web:build`
5. For a genuinely pre-existing failure (reproducible on the PR's base, unrelated to this diff), follow CONTRIBUTING.md's documented exception: record it, note it in the PR, and do not attempt to fix it as part of this change.

## Output

Report pass/fail per command with actual output for failures, not a paraphrase. Do not claim the branch is ready to push unless every applicable command in the contract actually ran and passed (or was a documented pre-existing failure).
