# Shared `.claude` Config Home — Design

## Goal

Let OpenClaude consume the same user-level metadata directory that
Claude Code uses (`~/.claude/`), so conversations, skills, agents,
commands, output styles and settings are shared between the two CLIs.
The choice must be switchable entirely from the `/config` UI, must
default to `.claude` for clean installs, and must offer a migration of
existing `~/.openclaude/` content into `~/.claude/`.

## Background

### What already works

This is a fork of Claude Code, so the on-disk formats are already
identical — the obstacle is path *resolution*, not format. Verified
directly on a machine that has both CLIs installed:

- Project slugs match exactly. Both `~/.claude/projects/` and
  `~/.openclaude/projects/` contain `-Users-<user>-Code-openclaude`,
  produced by the same `sanitizePath()`
  (`src/utils/sessionStoragePortable.ts:311`).
- Transcript JSONL entries have the same shape in both trees (same
  writer code, inherited from upstream).
- Project-level config already reads both directory names:
  `PROJECT_CONFIG_DIR_NAMES = ['.openclaude', '.claude']`
  (`src/utils/markdownConfigLoader.ts:41`).
- `getSettingsFilePathForSource('userSettings')`
  (`src/utils/settings/settings.ts:285`) already falls back to
  `~/.claude/settings.json` when the file is absent in the config home.

### The two resolvers

Everything user-level flows through two independent functions, each
using the same "prefer the new name, fall back to the legacy name if
the new one is absent" heuristic:

| Resolver | File | Decides |
| --- | --- | --- |
| `resolveClaudeConfigHomeDir()` | `src/utils/envUtils.ts:27` | the directory: `~/.openclaude/` vs `~/.claude/` |
| `resolveGlobalClaudeFile()` | `src/utils/env.ts:18` | the file: `~/.openclaude.json` vs `~/.claude.json` |

`getClaudeConfigHomeDir()` is memoized and has ~69 call sites. Because
every one of them goes through that single accessor, changing the
resolver changes the whole system without touching the call sites.

### Why the current behavior hides Claude Code conversations

`resolveClaudeConfigHomeDir()` returns `~/.claude` only when
`~/.openclaude` does **not** exist. On any machine where both exist —
the common case for someone running both CLIs — it resolves to
`~/.openclaude`, and `listSessionsImpl.ts:335` scans only that tree.
Claude Code's conversations are therefore invisible to `/resume`.

## Decisions

Settled during brainstorming, recorded here because each one rules out
a plausible alternative:

1. **Mode is user-selectable via `/config`, defaulting to `.claude`.**
   Not a hard cut-over and not env-only.
2. **Scope is the directory `~/.claude/` only.** The global config file
   stays `~/.openclaude.json`. Rejected sharing `~/.claude.json`: it is
   rewritten whole on every save, the two CLIs' file locks are not
   interoperable, and it would put multi-provider state inside the
   official Claude Code config.
3. **Migration copies; it never moves.** `~/.openclaude/` stays intact
   as a backup, so reverting the mode restores the previous state.
4. **Migration covers every user-level surface**, with `settings.json`
   merged rather than overwritten.
5. **The new default applies to clean installs only.** An existing
   populated `~/.openclaude/` keeps its current behavior, so no one
   loses sight of their history on upgrade. Discovery happens through a
   spinner tip instead of a forced prompt.

## Design

### 1. Config-home resolution

New module `src/utils/configHome.ts`:

```ts
export type ConfigHomeMode = 'claude' | 'openclaude'
export function readConfigHomePreference(): ConfigHomeMode | undefined
export function writeConfigHomePreference(mode: ConfigHomeMode): void
```

`readConfigHomePreference()` reads the literal fixed paths
`~/.openclaude.json` then `~/.claude.json` with `readFileSync` +
`JSON.parse` in a try/catch, and pulls a single `configHome` key.

**It must not import `config.ts` or `env.ts`, and must not be
memoized.** This is load-bearing, not stylistic: `getGlobalClaudeFile()`
(`src/utils/env.ts:44`) calls `getClaudeConfigHomeDir()` to probe for
the legacy `.config.json`. Routing the preference read through the
normal global-config accessors would close a cycle — preference →
global config → config home → preference. Reading the fixed paths
directly breaks it. A test enforces this.

`writeConfigHomePreference()` persists through the existing
`saveGlobalConfig()`, i.e. into whichever global config file OpenClaude
already writes to today. It introduces no new file and no new
pollution.

`resolveClaudeConfigHomeDir()` (`src/utils/envUtils.ts:27`) gains a
four-level priority:

| # | Condition | Result |
| --- | --- | --- |
| 1 | `OPENCLAUDE_CONFIG_DIR` / `CLAUDE_CONFIG_DIR` set | env value (unchanged) |
| 2 | explicit preference recorded | `~/.claude` or `~/.openclaude` |
| 3 | `~/.openclaude` absent and `~/.claude` present | `~/.claude` (unchanged) |
| 4 | **new:** neither directory exists (clean install) | `~/.claude` |

Level 4 delivers ".claude for new installs"; level 3 preserves every
existing user on `~/.openclaude`. No migration is triggered by an
upgrade.

`GlobalConfig` (`src/utils/config.ts`) gains
`configHome?: ConfigHomeMode`.

### 2. `/config` UI

A `managedEnum` entry (the `Setting` union at
`src/components/Settings/Config.tsx:81` already supports enums backed by
a custom component) opening a new submenu `ConfigHomeMenu.tsx`, added to
the `SubMenu` union at `Config.tsx:87`. The entry is labelled
`Conversation & config folder`, with its current value rendered as
`~/.claude (shared with Claude Code)` or `~/.openclaude`. The submenu
shows:

- The directory in force **and which of the four levels decided it**.
  Without this, "why is it still on .openclaude?" is unanswerable from
  the UI.
- What each side holds: project count and session count under
  `~/.claude/projects/` and `~/.openclaude/projects/`.
- The two choices.
- When `.claude` is chosen and `~/.openclaude/` has content, the
  migration step, showing the plan before anything is written.
- `Restart OpenClaude to apply` on exit, matching the existing
  convention at `src/commands/provider/provider.tsx:520`. The resolvers
  are memoized and a live session already holds an open transcript path,
  so hot-swapping would split a conversation across two trees.

When an env override is set, the options render disabled with the reason
— env keeps winning.

### 3. Migration — `src/utils/configHomeMigration.ts`

Split in two so the UI can show the plan before acting:

```ts
export function planConfigHomeMigration(): MigrationPlan
export async function runConfigHomeMigration(
  plan: MigrationPlan,
  onProgress: (surface: string, done: number, total: number) => void,
): Promise<MigrationResult>
```

`MigrationPlan` is a per-surface breakdown: for `projects/`, the number
of projects and sessions plus the list of session UUIDs already present
at the destination; for each directory surface, the file count; for
`settings.json`, the set of conflicting keys. `MigrationResult` reports
copied, skipped and failed counts per surface. The UI renders the plan
verbatim before the user confirms.

Surfaces copied:

- `projects/` — per project, per session file.
- `history.jsonl` — appended, de-duplicated by exact line content
  (entries are self-contained JSON lines; identical lines are the same
  event replayed, not two distinct ones).
- `file-history/`, `sessions/`, `plugins/`.
- Every entry of `CLAUDE_CONFIG_DIRECTORIES`
  (`src/utils/markdownConfigLoader.ts:29`): `commands`, `agents`,
  `output-styles`, `skills`, `workflows`, plus `templates` under its
  feature flag.
- `settings.json` — merged, destination wins on conflict, with a
  timestamped backup written to `~/.claude/backups/` first, reusing the
  backup-directory convention of `src/utils/config.ts:1728`.

**The user-level directory list is derived from
`CLAUDE_CONFIG_DIRECTORIES`, never hand-copied.** That constant is the
same one `loadMarkdownFilesForSubdir` uses to build `userDir`
(`markdownConfigLoader.ts:367`), so a new subdirectory arriving in an
upstream sync is migrated automatically instead of being silently
orphaned.

Invariants:

- Never deletes or modifies anything under `~/.openclaude/`.
- A session UUID already present at the destination is **skipped, not
  overwritten**, and reported in the summary. Claude Code's own data is
  never clobbered.
- Idempotent: a second run copies only what is new.

### 4. Spinner tip

One entry appended to `externalTips` in
`src/services/tips/tipRegistry.ts`, consumed by `getTipToShowOnSpinner`
(`src/screens/REPL.tsx:1756`) and already covered by the "Show tips"
toggle at `Config.tsx:427`.

```
id: 'config-home-claude-dir'
cooldownSessions: 15
content: Use /config to keep conversations and settings in ~/.claude,
         shared with Claude Code
```

`isRelevant` returns true only when all three hold:

1. no preference has been recorded yet,
2. the active config home is `~/.openclaude`,
3. `~/.claude/projects/` exists and is non-empty.

So it surfaces only for people who actually have Claude Code installed
and have not yet decided, and it disappears permanently once they pick
either side. This is the discovery path that replaces the forced
first-boot prompt ruled out by decision 5.

### 5. Explicitly unaffected

Verified rather than assumed, because both were raised as concerns:

**Provider configuration.** The profile list, the active profile and
custom API keys live in `GlobalConfig`
(`src/utils/config.ts:713`, `providerProfiles?: ProviderProfile[]`),
i.e. in `~/.openclaude.json` — the file decision 2 keeps out of the
share. Switching directories moves none of it.

The one exception is the per-terminal-session profile pin at
`<configHome>/sessions/<sessionId>.json`
(`src/utils/providerProfiles.ts:126`, `:147`, `:159`), and only when
`isolateProviderSessions` is enabled. It is ephemeral state keyed by
terminal session id that does not survive a reboot, and `sessions/` is
in the migration list.

**Project configuration.** `PROJECT_CONFIG_DIR_NAMES` is used as
`join(current, configDirName, subdir)` walking up from the cwd
(`markdownConfigLoader.ts:315`) and never consults
`getClaudeConfigHomeDir()`. `projectSettings` and `localSettings`
resolve through `getOriginalCwd()` (`settings.ts:255`). A project's
`.claude/` and `.openclaude/` keep working exactly as today, with
unchanged precedence.

## Testing

- `configHome.test.ts` — the four-level priority table across env
  set/unset and each combination of existing directories; plus a test
  that `readConfigHomePreference` resolves in a clean module graph,
  guarding the cycle described in section 1.
- `configHomeMigration.test.ts` — UUID collision is skipped and
  reported; idempotency across two runs; `settings.json` merge with
  destination winning; backup written; source tree byte-identical
  afterwards; the surface list tracks `CLAUDE_CONFIG_DIRECTORIES`.
- `claudeConfigResolution.test.ts` — extended for the clean-install
  default.
- Tip `isRelevant` gating, in the style of `tipScheduler.test.ts`.

## Risks

- OpenClaude-specific keys end up in `~/.claude/settings.json`. Claude
  Code should ignore unknown keys but may warn about them.
- OpenClaude creates its own subdirectories inside `~/.claude/` —
  verified: `tasks/` (`src/utils/permissions/filesystem.ts:1954`) and
  `repomap-cache/` (`src/context/repoMap/cache.ts:24`). Note that
  `plans/` does *not* follow the config home: `getDefaultPlansDirectory`
  (`src/utils/plans.ts:56`) hardcodes `~/.openclaude/plans`. That
  pre-existing inconsistency is left as-is; this change neither
  introduces nor fixes it.
- With both CLIs running at once, per-session transcripts do not race
  (one file per session), but `history.jsonl` and `sessions/` are shared
  and may interleave.

## Out of scope

- Interoperable file locking between the two CLIs.
- Sharing `~/.claude.json` (decision 2).
- Dual-read across both trees without migrating (rejected approach B:
  its main benefit is redundant once migration copies everything).
