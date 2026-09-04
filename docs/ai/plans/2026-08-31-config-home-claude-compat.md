# Shared `.claude` Config Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let OpenClaude use `~/.claude/` as its user-level metadata
directory — shared with Claude Code — selectable from `/config`,
defaulting to `.claude` on clean installs, with a copy-only migration of
existing `~/.openclaude/` content.

**Architecture:** A dependency-free reader (`configHome.ts`) supplies an
explicit user preference to the single existing resolver
`resolveClaudeConfigHomeDir()` (`src/utils/envUtils.ts:27`), which all
~69 config-home call sites already funnel through. Nothing else in the
codebase learns about the new concept. Migration and UI are separate
modules layered on top.

**Tech Stack:** TypeScript (strict, ESM), React + Ink for the TUI,
`bun test` for tests, `getFsImplementation()`
(`src/utils/fsOperations.ts`) for all filesystem access.

**Spec:** `docs/superpowers/specs/2026-08-31-config-home-claude-compat-design.md`

## Global Constraints

- **`src/utils/configHome.ts` must not import `config.ts` or `env.ts`,
  and must not be memoized.** `getGlobalClaudeFile()`
  (`src/utils/env.ts:44`) calls `getClaudeConfigHomeDir()`, so routing
  the preference read through the global-config accessors closes the
  cycle preference → global config → config home → preference. Task 1
  ships a test that enforces this.
- **Deviation from the spec, decided during planning:** the spec names a
  `writeConfigHomePreference()` helper. Placing it in `configHome.ts`
  would need `saveGlobalConfig` from `config.ts` and close the very
  cycle above. The write is therefore done inline in the UI via
  `saveGlobalConfig(c => ({ ...c, configHome: mode }))`, exactly as every
  other setting in `Config.tsx` does. `configHome.ts` is read-only.
- Migration **never** deletes, moves or modifies anything under
  `~/.openclaude/`. Copy only.
- Migration **never overwrites** a file that already exists at the
  destination. Claude Code's data is never clobbered.
- The user-level directory list is derived from
  `CLAUDE_CONFIG_DIRECTORIES` (`src/utils/markdownConfigLoader.ts:29`),
  never hand-copied.
- All filesystem access goes through `getFsImplementation()`, not bare
  `node:fs`, so tests can inject a virtual fs and so the codebase's
  slow-IO logging keeps working.
- Run focused tests with `bun test <path>`. Before finishing, run
  `bun run typecheck`.

---

### Task 1: Dependency-free preference reader

**Files:**
- Create: `src/utils/configHome.ts`
- Test: `src/utils/configHome.test.ts`

**Interfaces:**
- Consumes: `getFsImplementation()` from `./fsOperations.js`.
- Produces:
  - `type ConfigHomeMode = 'claude' | 'openclaude'`
  - `readConfigHomePreference(options?: { homeDir?: string }): ConfigHomeMode | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/utils/configHome.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readConfigHomePreference } from './configHome.js'

function withTempHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'config-home-test-'))
  try {
    fn(home)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('readConfigHomePreference', () => {
  test('returns undefined when neither config file exists', () => {
    withTempHome(home => {
      expect(readConfigHomePreference({ homeDir: home })).toBeUndefined()
    })
  })

  test('reads the preference from ~/.openclaude.json', () => {
    withTempHome(home => {
      writeFileSync(
        join(home, '.openclaude.json'),
        JSON.stringify({ configHome: 'claude' }),
      )
      expect(readConfigHomePreference({ homeDir: home })).toBe('claude')
    })
  })

  test('falls back to ~/.claude.json when .openclaude.json has no preference', () => {
    withTempHome(home => {
      writeFileSync(join(home, '.openclaude.json'), JSON.stringify({}))
      writeFileSync(
        join(home, '.claude.json'),
        JSON.stringify({ configHome: 'openclaude' }),
      )
      expect(readConfigHomePreference({ homeDir: home })).toBe('openclaude')
    })
  })

  test('.openclaude.json wins over .claude.json', () => {
    withTempHome(home => {
      writeFileSync(
        join(home, '.openclaude.json'),
        JSON.stringify({ configHome: 'openclaude' }),
      )
      writeFileSync(
        join(home, '.claude.json'),
        JSON.stringify({ configHome: 'claude' }),
      )
      expect(readConfigHomePreference({ homeDir: home })).toBe('openclaude')
    })
  })

  test('ignores malformed JSON and keeps scanning', () => {
    withTempHome(home => {
      writeFileSync(join(home, '.openclaude.json'), '{ not json')
      writeFileSync(
        join(home, '.claude.json'),
        JSON.stringify({ configHome: 'claude' }),
      )
      expect(readConfigHomePreference({ homeDir: home })).toBe('claude')
    })
  })

  test('ignores an unrecognised preference value', () => {
    withTempHome(home => {
      writeFileSync(
        join(home, '.openclaude.json'),
        JSON.stringify({ configHome: 'somewhere-else' }),
      )
      expect(readConfigHomePreference({ homeDir: home })).toBeUndefined()
    })
  })

  // Guards the import cycle described in the spec: getGlobalClaudeFile()
  // (env.ts) calls getClaudeConfigHomeDir(), so if this module reached for
  // config.ts or env.ts the resolver could never read the preference.
  test('does not import config.ts or env.ts', () => {
    const source = readFileSync(
      new URL('./configHome.ts', import.meta.url).pathname,
      'utf8',
    )
    expect(source).not.toMatch(/from '\.\/config\.js'/)
    expect(source).not.toMatch(/from '\.\/env\.js'/)
    expect(source).not.toMatch(/from '\.\/envUtils\.js'/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/configHome.test.ts`
Expected: FAIL — `Cannot find module './configHome.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/configHome.ts`:

```ts
import { homedir } from 'os'
import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'

export type ConfigHomeMode = 'claude' | 'openclaude'

/**
 * Basenames scanned for the explicit config-home preference, in priority
 * order. These are LITERAL fixed paths under the home directory — never
 * resolved through getGlobalClaudeFile(), which would be circular.
 */
const PREFERENCE_FILE_BASENAMES = ['.openclaude.json', '.claude.json'] as const

function isConfigHomeMode(value: unknown): value is ConfigHomeMode {
  return value === 'claude' || value === 'openclaude'
}

/**
 * Reads the user's explicit choice of user-level config directory.
 *
 * MUST NOT import config.ts / env.ts / envUtils.ts and MUST NOT be
 * memoized: getGlobalClaudeFile() (env.ts:44) calls
 * getClaudeConfigHomeDir(), so routing this read through the normal
 * global-config accessors would close the cycle
 * preference -> global config -> config home -> preference.
 * configHome.test.ts enforces this.
 *
 * Returns undefined when the user has never made an explicit choice, which
 * is what keeps existing installs on their current directory.
 */
export function readConfigHomePreference(options?: {
  homeDir?: string
}): ConfigHomeMode | undefined {
  const homeDir = options?.homeDir ?? homedir()
  const fs = getFsImplementation()

  for (const basename of PREFERENCE_FILE_BASENAMES) {
    try {
      const raw = fs.readFileSync(join(homeDir, basename), {
        encoding: 'utf8',
      })
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const value = (parsed as { configHome?: unknown }).configHome
        if (isConfigHomeMode(value)) {
          return value
        }
      }
    } catch {
      // Missing, unreadable or malformed file — try the next candidate.
    }
  }

  return undefined
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/configHome.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/configHome.ts src/utils/configHome.test.ts
git commit -m "feat(config): add dependency-free config-home preference reader"
```

---

### Task 2: Wire the preference into the resolver

**Files:**
- Modify: `src/utils/envUtils.ts:27-48` (`resolveClaudeConfigHomeDir`)
- Modify: `src/utils/config.ts` (add `configHome` to the `GlobalConfig` type, next to `providerProfiles` at `:713`)
- Modify: `src/utils/openclaudePaths.test.ts:43-66` (repair two tests that break under the new clean-install default)
- Test: `src/utils/configHome.resolution.test.ts`

**Interfaces:**
- Consumes: `readConfigHomePreference` and `ConfigHomeMode` from Task 1.
- Produces: `resolveClaudeConfigHomeDir({ configDirEnv?, homeDir? })` with
  four-level priority; `GlobalConfig.configHome?: ConfigHomeMode`.

The four levels, in order: (1) env override, (2) explicit preference,
(3) existing heuristic — `.openclaude` absent and `.claude` present,
(4) **new** — neither directory exists, i.e. a clean install → `.claude`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/configHome.resolution.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolveClaudeConfigHomeDir } from './envUtils.js'

function withTempHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'config-home-resolve-'))
  try {
    fn(home)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

function writePreference(home: string, mode: string): void {
  writeFileSync(
    join(home, '.openclaude.json'),
    JSON.stringify({ configHome: mode }),
  )
}

describe('resolveClaudeConfigHomeDir priority', () => {
  test('level 1: env override beats an explicit preference', () => {
    withTempHome(home => {
      writePreference(home, 'openclaude')
      expect(
        resolveClaudeConfigHomeDir({
          configDirEnv: '/custom/dir',
          homeDir: home,
        }),
      ).toBe('/custom/dir')
    })
  })

  test('level 2: explicit "claude" preference wins over both dirs existing', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writePreference(home, 'claude')
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.claude'),
      )
    })
  })

  test('level 2: explicit "openclaude" preference wins when only .claude exists', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.claude'), { recursive: true })
      writePreference(home, 'openclaude')
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.openclaude'),
      )
    })
  })

  test('level 3: no preference, only .claude exists -> .claude', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.claude'), { recursive: true })
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.claude'),
      )
    })
  })

  test('level 3: no preference, both exist -> .openclaude (existing installs stay put)', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.openclaude'),
      )
    })
  })

  test('level 3: no preference, only .openclaude exists -> .openclaude', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.openclaude'),
      )
    })
  })

  test('level 4: clean install, neither dir exists -> .claude', () => {
    withTempHome(home => {
      expect(resolveClaudeConfigHomeDir({ homeDir: home })).toBe(
        join(home, '.claude'),
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/configHome.resolution.test.ts`
Expected: FAIL — the two level-2 tests and the level-4 test fail; the
resolver still returns `.openclaude` because it ignores the preference
and defaults to `.openclaude` when nothing exists.

- [ ] **Step 3: Write minimal implementation**

In `src/utils/envUtils.ts`, add the import at the top of the file:

```ts
import { readConfigHomePreference } from './configHome.js'
```

Replace the body of `resolveClaudeConfigHomeDir` (currently
`src/utils/envUtils.ts:27-48`) with:

```ts
export function resolveClaudeConfigHomeDir(options?: {
  configDirEnv?: string
  homeDir?: string
}): string {
  // Level 1: an explicit env override always wins.
  if (options?.configDirEnv) {
    return options.configDirEnv.normalize('NFC')
  }

  const homeDir = options?.homeDir ?? homedir()
  const openClaudeDir = join(homeDir, '.openclaude')
  const claudeDir = join(homeDir, '.claude')

  // Level 2: the user's explicit choice, made in /config.
  const preference = readConfigHomePreference({ homeDir })
  if (preference === 'claude') {
    return claudeDir.normalize('NFC')
  }
  if (preference === 'openclaude') {
    return openClaudeDir.normalize('NFC')
  }

  try {
    const fs = getFsImplementation()
    const hasOpenClaude = fs.existsSync(openClaudeDir)
    // Level 3: legacy install with only ~/.claude present.
    if (!hasOpenClaude && fs.existsSync(claudeDir)) {
      return claudeDir.normalize('NFC')
    }
    // Level 4: clean install — neither directory exists yet. New installs
    // share Claude Code's directory by default. An existing populated
    // ~/.openclaude falls through to the return below and stays put, so
    // nobody loses sight of their history on upgrade.
    if (!hasOpenClaude) {
      return claudeDir.normalize('NFC')
    }
  } catch {
    // Ignore fs errors and fall back to the default openClaudeDir
  }

  return openClaudeDir.normalize('NFC')
}
```

In `src/utils/config.ts`, add the field to the `GlobalConfig` type
immediately after `activeProviderProfileId?: string` (`:714`):

```ts
  // User-level metadata directory: 'claude' shares ~/.claude with Claude
  // Code, 'openclaude' keeps ~/.openclaude. Absent means "never chosen",
  // which preserves the existing-install behaviour. Read by
  // readConfigHomePreference() in configHome.ts — which parses this file
  // directly rather than importing config.ts, to avoid an import cycle.
  configHome?: 'claude' | 'openclaude'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/configHome.resolution.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Repair the two pre-existing tests that assume the old default**

`src/utils/openclaudePaths.test.ts:43` (`defaults user config home to
~/.openclaude`) and `:56` (`hard-cuts user config home to ~/.openclaude
by default`) call `resolveClaudeConfigHomeDir({ homeDir: homedir() })`
against the real home directory. They pass on a developer machine only
because `~/.openclaude` happens to exist there. On a clean CI runner
neither directory exists, level 4 now applies, and both fail.

Make them deterministic by pinning a temp home that has `~/.openclaude`.
Replace both test bodies with:

```ts
  test('defaults user config home to ~/.openclaude', async () => {
    await acquireEnvMutex()
    delete process.env.OPENCLAUDE_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    const tempHome = mkdtempSync(join(tmpdir(), 'openclaude-paths-test-'))
    try {
      // An existing ~/.openclaude is what keeps an install on .openclaude;
      // without it the clean-install default (level 4) selects ~/.claude.
      mkdirSync(join(tempHome, '.openclaude'), { recursive: true })
      expect(
        resolveClaudeConfigHomeDir({
          homeDir: tempHome,
        }),
      ).toBe(join(tempHome, '.openclaude'))
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('hard-cuts user config home to ~/.openclaude by default', async () => {
    await acquireEnvMutex()
    delete process.env.OPENCLAUDE_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    const tempHome = mkdtempSync(join(tmpdir(), 'openclaude-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.openclaude'), { recursive: true })
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      expect(
        resolveClaudeConfigHomeDir({
          homeDir: tempHome,
        }),
      ).toBe(join(tempHome, '.openclaude'))
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
```

`mkdtempSync`, `mkdirSync`, `rmSync`, `tmpdir` and `join` are already
imported at the top of that file. `homedir` may become unused — if
`bun run check` reports it, drop it from the import list.

- [ ] **Step 6: Extend `claudeConfigResolution.test.ts` for the new default**

The spec's Testing section names this file specifically. Add one test
inside the existing
`describe('Claude Config Resolution & Merging (.claude and .openclaude)')`
block, next to the existing
`resolveClaudeConfigHomeDir falls back to ~/.claude when ~/.openclaude does not exist`
test:

```ts
  test('resolveClaudeConfigHomeDir defaults a clean install to ~/.claude', () => {
    const fakeHome = join(tempDir, 'clean_home')
    mkdirSync(fakeHome, { recursive: true })
    // Neither ~/.openclaude nor ~/.claude exists: a brand-new install
    // shares Claude Code's directory.
    expect(resolveClaudeConfigHomeDir({ homeDir: fakeHome })).toBe(
      join(fakeHome, '.claude'),
    )
  })
```

`mkdirSync`, `join` and `resolveClaudeConfigHomeDir` are already imported
at the top of that file.

- [ ] **Step 7: Run the full path and resolution suites**

Run:
```bash
bun test src/utils/openclaudePaths.test.ts src/utils/claudeConfigResolution.test.ts src/utils/configHome.resolution.test.ts
```
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/utils/envUtils.ts src/utils/config.ts \
  src/utils/configHome.resolution.test.ts src/utils/openclaudePaths.test.ts \
  src/utils/claudeConfigResolution.test.ts
git commit -m "feat(config): honour explicit config-home preference and default new installs to .claude"
```

---

### Task 3: Migration planner

**Files:**
- Create: `src/utils/configHomeMigration.ts`
- Test: `src/utils/configHomeMigration.plan.test.ts`

**Interfaces:**
- Consumes: `CLAUDE_CONFIG_DIRECTORIES` from
  `./markdownConfigLoader.js`; `getFsImplementation()` from
  `./fsOperations.js`.
- Produces:

```ts
export type MigrationSurface = {
  /** Directory name relative to the config home, or 'settings.json'. */
  name: string
  /** Files that will be copied. */
  fileCount: number
  /** Files skipped because the destination already has them. */
  skippedCount: number
}

export type MigrationPlan = {
  sourceDir: string
  destDir: string
  surfaces: MigrationSurface[]
  /** Session UUIDs present on both sides; these are never overwritten. */
  collidingSessionIds: string[]
  /** settings.json keys present on both sides; destination wins. */
  conflictingSettingsKeys: string[]
  totalFilesToCopy: number
}

export function planConfigHomeMigration(options?: {
  homeDir?: string
}): MigrationPlan
```

- [ ] **Step 1: Write the failing test**

Create `src/utils/configHomeMigration.plan.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { planConfigHomeMigration } from './configHomeMigration.js'

function withTempHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'config-home-plan-'))
  try {
    fn(home)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

function writeFileAt(path: string, contents: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, contents)
}

describe('planConfigHomeMigration', () => {
  test('counts session files per project', () => {
    withTempHome(home => {
      const proj = join(home, '.openclaude', 'projects', '-Users-x-repo')
      mkdirSync(proj, { recursive: true })
      writeFileSync(join(proj, 'aaa.jsonl'), '{}\n')
      writeFileSync(join(proj, 'bbb.jsonl'), '{}\n')

      const plan = planConfigHomeMigration({ homeDir: home })
      const projects = plan.surfaces.find(s => s.name === 'projects')

      expect(projects?.fileCount).toBe(2)
      expect(projects?.skippedCount).toBe(0)
      expect(plan.collidingSessionIds).toEqual([])
    })
  })

  test('reports a session UUID that already exists at the destination', () => {
    withTempHome(home => {
      const src = join(home, '.openclaude', 'projects', '-Users-x-repo')
      const dst = join(home, '.claude', 'projects', '-Users-x-repo')
      mkdirSync(src, { recursive: true })
      mkdirSync(dst, { recursive: true })
      writeFileSync(join(src, 'shared.jsonl'), '{}\n')
      writeFileSync(join(src, 'only-source.jsonl'), '{}\n')
      writeFileSync(join(dst, 'shared.jsonl'), '{}\n')

      const plan = planConfigHomeMigration({ homeDir: home })
      const projects = plan.surfaces.find(s => s.name === 'projects')

      expect(projects?.fileCount).toBe(1)
      expect(projects?.skippedCount).toBe(1)
      expect(plan.collidingSessionIds).toEqual(['shared'])
    })
  })

  test('covers every entry of CLAUDE_CONFIG_DIRECTORIES', async () => {
    const { CLAUDE_CONFIG_DIRECTORIES } = await import(
      './markdownConfigLoader.js'
    )
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      const plan = planConfigHomeMigration({ homeDir: home })
      const names = plan.surfaces.map(s => s.name)
      for (const dir of CLAUDE_CONFIG_DIRECTORIES) {
        expect(names).toContain(dir)
      }
      expect(names).toContain('projects')
      expect(names).toContain('plugins')
      expect(names).toContain('settings.json')
    })
  })

  test('reports conflicting settings.json keys', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.openclaude', 'settings.json'),
        JSON.stringify({ theme: 'dark', bashSecurityLevel: 'smart' }),
      )
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        JSON.stringify({ theme: 'light' }),
      )

      const plan = planConfigHomeMigration({ homeDir: home })
      expect(plan.conflictingSettingsKeys).toEqual(['theme'])
    })
  })

  test('an absent source directory yields an empty plan, not an error', () => {
    withTempHome(home => {
      const plan = planConfigHomeMigration({ homeDir: home })
      expect(plan.totalFilesToCopy).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/configHomeMigration.plan.test.ts`
Expected: FAIL — `Cannot find module './configHomeMigration.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/configHomeMigration.ts`:

```ts
import { homedir } from 'os'
import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'
import { CLAUDE_CONFIG_DIRECTORIES } from './markdownConfigLoader.js'

export type MigrationSurface = {
  name: string
  fileCount: number
  skippedCount: number
}

export type MigrationPlan = {
  sourceDir: string
  destDir: string
  surfaces: MigrationSurface[]
  collidingSessionIds: string[]
  conflictingSettingsKeys: string[]
  totalFilesToCopy: number
}

/**
 * Directory surfaces copied on top of CLAUDE_CONFIG_DIRECTORIES. The
 * markdown-loader directories (commands/agents/skills/...) are derived from
 * that shared constant rather than repeated here, so a subdirectory added by
 * an upstream sync is migrated automatically instead of silently orphaned.
 */
const EXTRA_DIRECTORY_SURFACES = [
  'projects',
  'file-history',
  'sessions',
  'plugins',
] as const

function listFilesRecursive(dir: string): string[] {
  const fs = getFsImplementation()
  const out: string[] = []
  let entries: string[]
  try {
    entries = fs.readdirStringSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      if (fs.statSync(full).isDirectory()) {
        out.push(...listFilesRecursive(full))
      } else {
        out.push(full)
      }
    } catch {
      // Entry vanished between readdir and stat — skip it.
    }
  }
  return out
}

function readJsonObject(path: string): Record<string, unknown> | undefined {
  try {
    const raw = getFsImplementation().readFileSync(path, { encoding: 'utf8' })
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Missing or malformed — treated as absent.
  }
  return undefined
}

function planDirectorySurface(
  name: string,
  sourceDir: string,
  destDir: string,
): MigrationSurface {
  const fs = getFsImplementation()
  const sourceRoot = join(sourceDir, name)
  let fileCount = 0
  let skippedCount = 0

  for (const sourceFile of listFilesRecursive(sourceRoot)) {
    const relative = sourceFile.slice(sourceRoot.length + 1)
    const destFile = join(destDir, name, relative)
    if (fs.existsSync(destFile)) {
      skippedCount++
    } else {
      fileCount++
    }
  }

  return { name, fileCount, skippedCount }
}

export function planConfigHomeMigration(options?: {
  homeDir?: string
}): MigrationPlan {
  const homeDir = options?.homeDir ?? homedir()
  const sourceDir = join(homeDir, '.openclaude')
  const destDir = join(homeDir, '.claude')
  const fs = getFsImplementation()

  const directoryNames = [
    ...EXTRA_DIRECTORY_SURFACES,
    ...CLAUDE_CONFIG_DIRECTORIES,
  ]
  const surfaces = directoryNames.map(name =>
    planDirectorySurface(name, sourceDir, destDir),
  )

  // history.jsonl is a flat append-only log, counted as one surface.
  const historySource = join(sourceDir, 'history.jsonl')
  surfaces.push({
    name: 'history.jsonl',
    fileCount: fs.existsSync(historySource) ? 1 : 0,
    skippedCount: 0,
  })

  // Session UUIDs present on both sides, reported so the UI can say what
  // will be left alone. Derived from the projects surface.
  const collidingSessionIds: string[] = []
  const projectsSource = join(sourceDir, 'projects')
  for (const sourceFile of listFilesRecursive(projectsSource)) {
    if (!sourceFile.endsWith('.jsonl')) continue
    const relative = sourceFile.slice(projectsSource.length + 1)
    if (fs.existsSync(join(destDir, 'projects', relative))) {
      const base = relative.split('/').pop() ?? relative
      collidingSessionIds.push(base.replace(/\.jsonl$/, ''))
    }
  }

  const sourceSettings = readJsonObject(join(sourceDir, 'settings.json'))
  const destSettings = readJsonObject(join(destDir, 'settings.json'))
  const conflictingSettingsKeys =
    sourceSettings && destSettings
      ? Object.keys(sourceSettings).filter(key => key in destSettings)
      : []
  surfaces.push({
    name: 'settings.json',
    fileCount: sourceSettings ? 1 : 0,
    skippedCount: 0,
  })

  const totalFilesToCopy = surfaces.reduce((sum, s) => sum + s.fileCount, 0)

  return {
    sourceDir,
    destDir,
    surfaces,
    collidingSessionIds,
    conflictingSettingsKeys,
    totalFilesToCopy,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/configHomeMigration.plan.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/configHomeMigration.ts \
  src/utils/configHomeMigration.plan.test.ts
git commit -m "feat(config): add config-home migration planner"
```

---

### Task 4: Migration runner

**Files:**
- Modify: `src/utils/configHomeMigration.ts` (append the runner)
- Test: `src/utils/configHomeMigration.run.test.ts`

**Interfaces:**
- Consumes: `MigrationPlan`, `planConfigHomeMigration` from Task 3.
- Produces:

```ts
export type MigrationResult = {
  copiedFiles: number
  skippedFiles: number
  errors: { path: string; message: string }[]
  settingsBackupPath?: string
}

export async function runConfigHomeMigration(
  plan: MigrationPlan,
  onProgress?: (surfaceName: string, done: number, total: number) => void,
): Promise<MigrationResult>
```

- [ ] **Step 1: Write the failing test**

Create `src/utils/configHomeMigration.run.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  planConfigHomeMigration,
  runConfigHomeMigration,
} from './configHomeMigration.js'

function withTempHome(fn: (home: string) => Promise<void>): Promise<void> {
  const home = mkdtempSync(join(tmpdir(), 'config-home-run-'))
  return fn(home).finally(() => {
    rmSync(home, { recursive: true, force: true })
  })
}

describe('runConfigHomeMigration', () => {
  test('copies sessions and leaves the source untouched', async () => {
    await withTempHome(async home => {
      const src = join(home, '.openclaude', 'projects', '-Users-x-repo')
      mkdirSync(src, { recursive: true })
      writeFileSync(join(src, 'aaa.jsonl'), 'session-a\n')

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(result.copiedFiles).toBe(1)
      expect(result.errors).toEqual([])
      expect(
        readFileSync(
          join(home, '.claude', 'projects', '-Users-x-repo', 'aaa.jsonl'),
          'utf8',
        ),
      ).toBe('session-a\n')
      // Copy, never move.
      expect(existsSync(join(src, 'aaa.jsonl'))).toBe(true)
    })
  })

  test('never overwrites a session that already exists at the destination', async () => {
    await withTempHome(async home => {
      const src = join(home, '.openclaude', 'projects', '-Users-x-repo')
      const dst = join(home, '.claude', 'projects', '-Users-x-repo')
      mkdirSync(src, { recursive: true })
      mkdirSync(dst, { recursive: true })
      writeFileSync(join(src, 'shared.jsonl'), 'from-openclaude\n')
      writeFileSync(join(dst, 'shared.jsonl'), 'from-claude-code\n')

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(result.skippedFiles).toBe(1)
      expect(readFileSync(join(dst, 'shared.jsonl'), 'utf8')).toBe(
        'from-claude-code\n',
      )
    })
  })

  test('is idempotent: a second run copies nothing new', async () => {
    await withTempHome(async home => {
      const src = join(home, '.openclaude', 'skills', 'my-skill')
      mkdirSync(src, { recursive: true })
      writeFileSync(join(src, 'SKILL.md'), 'skill body\n')

      const first = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )
      const second = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(first.copiedFiles).toBe(1)
      expect(second.copiedFiles).toBe(0)
    })
  })

  test('merges settings.json with the destination winning, after a backup', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.openclaude', 'settings.json'),
        JSON.stringify({ theme: 'dark', bashSecurityLevel: 'smart' }),
      )
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        JSON.stringify({ theme: 'light' }),
      )

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      const merged = JSON.parse(
        readFileSync(join(home, '.claude', 'settings.json'), 'utf8'),
      )
      // Destination wins on conflict; non-conflicting source keys are added.
      expect(merged.theme).toBe('light')
      expect(merged.bashSecurityLevel).toBe('smart')

      expect(result.settingsBackupPath).toBeDefined()
      const backups = readdirSync(join(home, '.claude', 'backups'))
      expect(backups.length).toBe(1)
      expect(
        JSON.parse(
          readFileSync(join(home, '.claude', 'backups', backups[0]!), 'utf8'),
        ).theme,
      ).toBe('light')
    })
  })

  test('copies settings.json wholesale when the destination has none', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      writeFileSync(
        join(home, '.openclaude', 'settings.json'),
        JSON.stringify({ theme: 'dark' }),
      )

      await runConfigHomeMigration(planConfigHomeMigration({ homeDir: home }))

      expect(
        JSON.parse(
          readFileSync(join(home, '.claude', 'settings.json'), 'utf8'),
        ).theme,
      ).toBe('dark')
    })
  })

  test('appends history.jsonl without duplicating identical lines', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.openclaude', 'history.jsonl'),
        '{"a":1}\n{"b":2}\n',
      )
      writeFileSync(join(home, '.claude', 'history.jsonl'), '{"b":2}\n')

      await runConfigHomeMigration(planConfigHomeMigration({ homeDir: home }))

      const lines = readFileSync(join(home, '.claude', 'history.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
      expect(lines).toEqual(['{"b":2}', '{"a":1}'])
    })
  })

  test('reports progress per surface', async () => {
    await withTempHome(async home => {
      const src = join(home, '.openclaude', 'agents')
      mkdirSync(src, { recursive: true })
      writeFileSync(join(src, 'one.md'), 'a\n')
      writeFileSync(join(src, 'two.md'), 'b\n')

      const seen: string[] = []
      await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
        surface => seen.push(surface),
      )

      expect(seen).toContain('agents')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/configHomeMigration.run.test.ts`
Expected: FAIL — `runConfigHomeMigration is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/configHomeMigration.ts`:

```ts
export type MigrationResult = {
  copiedFiles: number
  skippedFiles: number
  errors: { path: string; message: string }[]
  settingsBackupPath?: string
}

function copyFileIfAbsent(
  sourceFile: string,
  destFile: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  if (fs.existsSync(destFile)) {
    result.skippedFiles++
    return
  }
  try {
    fs.mkdirSync(join(destFile, '..'))
    fs.copyFileSync(sourceFile, destFile)
    result.copiedFiles++
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function mergeHistory(
  sourceDir: string,
  destDir: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  const sourceFile = join(sourceDir, 'history.jsonl')
  const destFile = join(destDir, 'history.jsonl')
  if (!fs.existsSync(sourceFile)) {
    return
  }
  if (!fs.existsSync(destFile)) {
    copyFileIfAbsent(sourceFile, destFile, result)
    return
  }
  try {
    const readLines = (path: string): string[] =>
      fs
        .readFileSync(path, { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.length > 0)

    const destLines = readLines(destFile)
    // De-duplicate by exact line content: history entries are self-contained
    // JSON lines, so an identical line is the same event replayed rather than
    // two distinct events.
    const seen = new Set(destLines)
    const added = readLines(sourceFile).filter(line => !seen.has(line))
    if (added.length > 0) {
      fs.appendFileSync(destFile, `${added.join('\n')}\n`)
      result.copiedFiles++
    }
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function mergeSettings(
  sourceDir: string,
  destDir: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  const sourceFile = join(sourceDir, 'settings.json')
  const destFile = join(destDir, 'settings.json')
  const sourceSettings = readJsonObject(sourceFile)
  if (!sourceSettings) {
    return
  }

  const destSettings = readJsonObject(destFile)
  if (!destSettings) {
    copyFileIfAbsent(sourceFile, destFile, result)
    return
  }

  try {
    // Timestamped backup first, in the same directory config.ts:1728 uses.
    const backupDir = join(destDir, 'backups')
    fs.mkdirSync(backupDir)
    const backupPath = join(backupDir, `settings.json.backup.${Date.now()}`)
    fs.copyFileSync(destFile, backupPath)
    result.settingsBackupPath = backupPath

    // Destination wins on conflict; source contributes only new keys.
    const merged = { ...sourceSettings, ...destSettings }
    fs.mkdirSync(destDir)
    writeFileSyncAndFlush_DEPRECATED(
      destFile,
      `${JSON.stringify(merged, null, 2)}\n`,
      { encoding: 'utf8' },
    )
    result.copiedFiles++
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Copies user-level content from ~/.openclaude into ~/.claude.
 *
 * Invariants, enforced by configHomeMigration.run.test.ts:
 * - never deletes, moves or modifies anything under the source
 * - never overwrites a file that already exists at the destination
 * - idempotent: a second run copies only what is new
 */
export async function runConfigHomeMigration(
  plan: MigrationPlan,
  onProgress?: (surfaceName: string, done: number, total: number) => void,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    copiedFiles: 0,
    skippedFiles: 0,
    errors: [],
  }

  const directoryNames = [
    ...EXTRA_DIRECTORY_SURFACES,
    ...CLAUDE_CONFIG_DIRECTORIES,
  ]

  for (const name of directoryNames) {
    const sourceRoot = join(plan.sourceDir, name)
    const files = listFilesRecursive(sourceRoot)
    let done = 0
    for (const sourceFile of files) {
      const relative = sourceFile.slice(sourceRoot.length + 1)
      copyFileIfAbsent(sourceFile, join(plan.destDir, name, relative), result)
      done++
      onProgress?.(name, done, files.length)
    }
    if (files.length > 0) {
      onProgress?.(name, files.length, files.length)
    }
  }

  mergeHistory(plan.sourceDir, plan.destDir, result)
  onProgress?.('history.jsonl', 1, 1)

  mergeSettings(plan.sourceDir, plan.destDir, result)
  onProgress?.('settings.json', 1, 1)

  return result
}
```

Add this import to the top of `src/utils/configHomeMigration.ts`:

```ts
import { writeFileSyncAndFlush_DEPRECATED } from './file.js'
```

Note: `mkdirSync` in `getFsImplementation()` is recursive by default
(`src/utils/fsOperations.ts:133`), so no `{ recursive: true }` is needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/configHomeMigration.run.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Run both migration suites together**

Run: `bun test src/utils/configHomeMigration.plan.test.ts src/utils/configHomeMigration.run.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 6: Commit**

```bash
git add src/utils/configHomeMigration.ts \
  src/utils/configHomeMigration.run.test.ts
git commit -m "feat(config): add copy-only config-home migration runner"
```

---

### Task 5: Discovery spinner tip

**Files:**
- Create: `src/utils/configHomeSuggestion.ts`
- Modify: `src/services/tips/tipRegistry.ts` (append to the `externalTips` array that starts at `:100`)
- Test: `src/utils/configHomeSuggestion.test.ts`

**Interfaces:**
- Consumes: `readConfigHomePreference` (Task 1),
  `getClaudeConfigHomeDir` from `./envUtils.js`.
- Produces: `shouldSuggestSharedClaudeHome(options?: { homeDir?: string }): boolean`

The gate lives in its own module rather than inline in `tipRegistry.ts`
so it can be tested without the registry's large dependency graph — the
reason `tipScheduler.test.ts` needs so much `mock.module` scaffolding.

- [ ] **Step 1: Write the failing test**

Create `src/utils/configHomeSuggestion.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { shouldSuggestSharedClaudeHome } from './configHomeSuggestion.js'

function withTempHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'config-home-tip-'))
  try {
    fn(home)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

function seedClaudeProjects(home: string): void {
  const dir = join(home, '.claude', 'projects', '-Users-x-repo')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'aaa.jsonl'), '{}\n')
}

describe('shouldSuggestSharedClaudeHome', () => {
  test('suggests when on .openclaude, undecided, and Claude Code has projects', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      seedClaudeProjects(home)
      expect(shouldSuggestSharedClaudeHome({ homeDir: home })).toBe(true)
    })
  })

  test('stays silent once a preference has been recorded', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      seedClaudeProjects(home)
      writeFileSync(
        join(home, '.openclaude.json'),
        JSON.stringify({ configHome: 'openclaude' }),
      )
      expect(shouldSuggestSharedClaudeHome({ homeDir: home })).toBe(false)
    })
  })

  test('stays silent when Claude Code has no projects', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude', 'projects'), { recursive: true })
      expect(shouldSuggestSharedClaudeHome({ homeDir: home })).toBe(false)
    })
  })

  test('stays silent when Claude Code is not installed at all', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      expect(shouldSuggestSharedClaudeHome({ homeDir: home })).toBe(false)
    })
  })

  test('stays silent when the active config home is already .claude', () => {
    withTempHome(home => {
      seedClaudeProjects(home)
      // No ~/.openclaude at all, so the resolver already selects ~/.claude.
      expect(shouldSuggestSharedClaudeHome({ homeDir: home })).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/configHomeSuggestion.test.ts`
Expected: FAIL — `Cannot find module './configHomeSuggestion.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/configHomeSuggestion.ts`:

```ts
import { homedir } from 'os'
import { join } from 'path'
import { readConfigHomePreference } from './configHome.js'
import { resolveClaudeConfigHomeDir } from './envUtils.js'
import { getFsImplementation } from './fsOperations.js'

/**
 * Whether to surface the "you can share ~/.claude with Claude Code" tip.
 *
 * True only when the suggestion is actionable AND the user has not already
 * decided, so the tip disappears permanently once they pick either side:
 *   1. no explicit preference recorded yet,
 *   2. the active config home is ~/.openclaude,
 *   3. ~/.claude/projects exists and is non-empty.
 */
export function shouldSuggestSharedClaudeHome(options?: {
  homeDir?: string
}): boolean {
  const homeDir = options?.homeDir ?? homedir()

  if (readConfigHomePreference({ homeDir }) !== undefined) {
    return false
  }

  const activeHome = resolveClaudeConfigHomeDir({ homeDir })
  if (activeHome !== join(homeDir, '.openclaude').normalize('NFC')) {
    return false
  }

  try {
    const fs = getFsImplementation()
    const claudeProjects = join(homeDir, '.claude', 'projects')
    return (
      fs.existsSync(claudeProjects) &&
      fs.readdirStringSync(claudeProjects).length > 0
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/configHomeSuggestion.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Register the tip**

In `src/services/tips/tipRegistry.ts`, add the import alongside the other
`../../utils/` imports:

```ts
import { shouldSuggestSharedClaudeHome } from '../../utils/configHomeSuggestion.js'
```

Append this entry to the `externalTips` array (which opens at `:100`),
following the exact shape of the neighbouring entries:

```ts
  {
    id: 'config-home-claude-dir',
    content: async () =>
      'Use /config to keep conversations and settings in ~/.claude, shared with Claude Code',
    cooldownSessions: 15,
    isRelevant: async () => shouldSuggestSharedClaudeHome(),
  },
```

- [ ] **Step 6: Verify the tip registry still loads**

Run: `bun test src/services/tips/tipScheduler.test.ts`
Expected: PASS — no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/utils/configHomeSuggestion.ts \
  src/utils/configHomeSuggestion.test.ts \
  src/services/tips/tipRegistry.ts
git commit -m "feat(config): add spinner tip suggesting the shared .claude directory"
```

---

### Task 6: Config-home submenu component

**Files:**
- Create: `src/components/Settings/ConfigHomeMenu.tsx`
- Test: `src/components/Settings/ConfigHomeMenu.test.tsx`

**Interfaces:**
- Consumes: `planConfigHomeMigration`, `runConfigHomeMigration`,
  `MigrationPlan` (Tasks 3-4); `readConfigHomePreference`,
  `ConfigHomeMode` (Task 1); `getClaudeConfigHomeDir`,
  `resolveConfigDirEnv` from `./envUtils.js`.
- Produces:

```ts
export type ConfigHomeMenuProps = {
  onComplete: (mode: ConfigHomeMode, migrated: boolean) => void
  onCancel: () => void
}
export function ConfigHomeMenu(props: ConfigHomeMenuProps): React.ReactNode
export function describeActiveConfigHome(options?: { homeDir?: string }): {
  path: string
  reason: 'env' | 'preference' | 'legacy-fallback' | 'clean-install-default'
}
```

`describeActiveConfigHome` is what lets the UI answer "why is it still
on .openclaude?" — the spec calls this out as unanswerable otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/components/Settings/ConfigHomeMenu.test.tsx`:

```tsx
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describeActiveConfigHome } from './ConfigHomeMenu.js'

function withTempHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'config-home-menu-'))
  try {
    fn(home)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('describeActiveConfigHome', () => {
  test('reports an explicit preference', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      writeFileSync(
        join(home, '.openclaude.json'),
        JSON.stringify({ configHome: 'claude' }),
      )
      const described = describeActiveConfigHome({ homeDir: home })
      expect(described.reason).toBe('preference')
      expect(described.path).toBe(join(home, '.claude'))
    })
  })

  test('reports the legacy fallback when only .claude exists', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.claude'), { recursive: true })
      expect(describeActiveConfigHome({ homeDir: home }).reason).toBe(
        'legacy-fallback',
      )
    })
  })

  test('reports the clean-install default when neither exists', () => {
    withTempHome(home => {
      expect(describeActiveConfigHome({ homeDir: home }).reason).toBe(
        'clean-install-default',
      )
    })
  })

  test('reports an env override', () => {
    withTempHome(home => {
      const previous = process.env.OPENCLAUDE_CONFIG_DIR
      process.env.OPENCLAUDE_CONFIG_DIR = join(home, 'custom')
      try {
        const described = describeActiveConfigHome({ homeDir: home })
        expect(described.reason).toBe('env')
        expect(described.path).toBe(join(home, 'custom'))
      } finally {
        if (previous === undefined) {
          delete process.env.OPENCLAUDE_CONFIG_DIR
        } else {
          process.env.OPENCLAUDE_CONFIG_DIR = previous
        }
      }
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/components/Settings/ConfigHomeMenu.test.tsx`
Expected: FAIL — `Cannot find module './ConfigHomeMenu.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Settings/ConfigHomeMenu.tsx`. Follow the file
conventions of the neighbouring `Config.tsx`: `.tsx` with React + Ink,
`Box`/`Text` from `ink`, and the repo's `Select` component.

```tsx
import { Box, Text } from 'ink';
import { homedir } from 'os';
import { join } from 'path';
import * as React from 'react';
import { readConfigHomePreference, type ConfigHomeMode } from '../../utils/configHome.js';
import {
  planConfigHomeMigration,
  runConfigHomeMigration,
  type MigrationPlan
} from '../../utils/configHomeMigration.js';
import { resolveClaudeConfigHomeDir, resolveConfigDirEnv } from '../../utils/envUtils.js';
import { getFsImplementation } from '../../utils/fsOperations.js';
import { Select } from '../CustomSelect/index.js';

export type ConfigHomeMenuProps = {
  onComplete: (mode: ConfigHomeMode, migrated: boolean) => void;
  onCancel: () => void;
};

/**
 * Which of the four resolution levels selected the active directory. The
 * submenu shows this because "why is it still on .openclaude?" is otherwise
 * unanswerable from the UI.
 */
export function describeActiveConfigHome(options?: {
  homeDir?: string;
}): {
  path: string;
  reason: 'env' | 'preference' | 'legacy-fallback' | 'clean-install-default';
} {
  const homeDir = options?.homeDir ?? homedir();
  const configDirEnv = resolveConfigDirEnv({
    openClaudeConfigDir: process.env.OPENCLAUDE_CONFIG_DIR,
    legacyConfigDir: process.env.CLAUDE_CONFIG_DIR
  });
  if (configDirEnv) {
    return {
      path: resolveClaudeConfigHomeDir({ configDirEnv }),
      reason: 'env'
    };
  }

  const path = resolveClaudeConfigHomeDir({ homeDir });
  if (readConfigHomePreference({ homeDir }) !== undefined) {
    return { path, reason: 'preference' };
  }

  const fs = getFsImplementation();
  const hasOpenClaude = fs.existsSync(join(homeDir, '.openclaude'));
  const hasClaude = fs.existsSync(join(homeDir, '.claude'));
  if (!hasOpenClaude && hasClaude) {
    return { path, reason: 'legacy-fallback' };
  }
  if (!hasOpenClaude && !hasClaude) {
    return { path, reason: 'clean-install-default' };
  }
  return { path, reason: 'preference' };
}

function countSessions(projectsDir: string): { projects: number; sessions: number } {
  const fs = getFsImplementation();
  let projects = 0;
  let sessions = 0;
  try {
    for (const entry of fs.readdirStringSync(projectsDir)) {
      const full = join(projectsDir, entry);
      if (!fs.statSync(full).isDirectory()) continue;
      projects++;
      sessions += fs
        .readdirStringSync(full)
        .filter(name => name.endsWith('.jsonl')).length;
    }
  } catch {
    // Directory absent — zero of both.
  }
  return { projects, sessions };
}

const REASON_LABEL: Record<
  ReturnType<typeof describeActiveConfigHome>['reason'],
  string
> = {
  env: 'set by OPENCLAUDE_CONFIG_DIR / CLAUDE_CONFIG_DIR',
  preference: 'your choice in /config',
  'legacy-fallback': 'only ~/.claude existed when OpenClaude first ran',
  'clean-install-default': 'default for a new install'
};

export function ConfigHomeMenu({
  onComplete,
  onCancel
}: ConfigHomeMenuProps): React.ReactNode {
  const home = homedir();
  const active = React.useMemo(() => describeActiveConfigHome(), []);
  const claudeCounts = React.useMemo(
    () => countSessions(join(home, '.claude', 'projects')),
    [home]
  );
  const openClaudeCounts = React.useMemo(
    () => countSessions(join(home, '.openclaude', 'projects')),
    [home]
  );

  const [pendingMode, setPendingMode] = React.useState<ConfigHomeMode | null>(null);
  const [plan, setPlan] = React.useState<MigrationPlan | null>(null);
  const [migrating, setMigrating] = React.useState(false);

  const envLocked = active.reason === 'env';

  if (envLocked) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Conversation &amp; config folder</Text>
        <Text>
          Currently {active.path} — {REASON_LABEL[active.reason]}.
        </Text>
        <Text dimColor>
          Unset the environment variable to choose a folder here.
        </Text>
        <Select
          options={[{ label: 'Back', value: 'back' }]}
          onChange={onCancel}
        />
      </Box>
    );
  }

  if (pendingMode && plan && !migrating) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Migrate to ~/.claude</Text>
        <Text>
          {plan.totalFilesToCopy} file(s) will be copied from {plan.sourceDir}.
          Nothing is deleted or overwritten.
        </Text>
        {plan.collidingSessionIds.length > 0 ? (
          <Text dimColor>
            {plan.collidingSessionIds.length} session(s) already exist at the
            destination and will be left untouched.
          </Text>
        ) : null}
        {plan.conflictingSettingsKeys.length > 0 ? (
          <Text dimColor>
            settings.json: {plan.conflictingSettingsKeys.join(', ')} already set
            at the destination and will be kept; a backup is written first.
          </Text>
        ) : null}
        <Select
          options={[
            { label: 'Copy now and switch', value: 'migrate' },
            { label: 'Switch without copying', value: 'switch' },
            { label: 'Cancel', value: 'cancel' }
          ]}
          onChange={choice => {
            if (choice === 'cancel') {
              onCancel();
              return;
            }
            if (choice === 'switch') {
              onComplete(pendingMode, false);
              return;
            }
            setMigrating(true);
            // Select's onChange returns void; keep the await off the handler
            // signature so this is not a misused promise.
            void runConfigHomeMigration(plan).then(() => {
              onComplete(pendingMode, true);
            });
          }}
        />
      </Box>
    );
  }

  if (migrating) {
    return <Text>Copying…</Text>;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Conversation &amp; config folder</Text>
      <Text>
        Currently {active.path} — {REASON_LABEL[active.reason]}.
      </Text>
      <Text dimColor>
        ~/.claude: {claudeCounts.projects} project(s), {claudeCounts.sessions}{' '}
        session(s) · ~/.openclaude: {openClaudeCounts.projects} project(s),{' '}
        {openClaudeCounts.sessions} session(s)
      </Text>
      <Select
        options={[
          { label: '~/.claude (shared with Claude Code)', value: 'claude' },
          { label: '~/.openclaude', value: 'openclaude' }
        ]}
        onChange={mode => {
          const next = mode as ConfigHomeMode;
          if (next === 'claude' && openClaudeCounts.sessions > 0) {
            setPendingMode(next);
            setPlan(planConfigHomeMigration());
            return;
          }
          onComplete(next, false);
        }}
      />
      <Text dimColor>Restart OpenClaude to apply.</Text>
    </Box>
  );
}
```

The `Select` API used above is verified: it is exported from
`src/components/CustomSelect/index.js` (the same import `Config.tsx:29`
uses) and takes `options: OptionWithDescription<T>[]`,
`onChange?: (value: T) => void` and `onCancel?: () => void`
(`src/components/CustomSelect/select.tsx:108-123`). The submenu's
own props mirror `LanguagePicker` (`src/components/LanguagePicker.tsx:12`),
which takes `onComplete` / `onCancel` and is rendered at
`Config.tsx:1950`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/components/Settings/ConfigHomeMenu.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/ConfigHomeMenu.tsx \
  src/components/Settings/ConfigHomeMenu.test.tsx
git commit -m "feat(config): add config-home submenu with migration preview"
```

---

### Task 7: Wire the submenu into `/config`

**Files:**
- Modify: `src/components/Settings/Config.tsx` — the `SubMenu` union
  (`:87`), the settings array (near the `language` entry at `:1029`), the
  `onChange` switch that opens submenus (`:1672-1679`), and the submenu
  render chain (`:1949`).

**Interfaces:**
- Consumes: `ConfigHomeMenu`, `describeActiveConfigHome` (Task 6);
  `saveGlobalConfig` from `../../utils/config.js` (already imported in
  `Config.tsx`).
- Produces: no new exports.

- [ ] **Step 1: Add the submenu to the union**

At `src/components/Settings/Config.tsx:87`, extend the type:

```ts
type SubMenu = 'Theme' | 'Model' | 'TeammateModel' | 'CompactModel' | 'ExternalIncludes' | 'OutputStyle' | 'ChannelDowngrade' | 'Language' | 'EnableAutoUpdates' | 'ConfigHome';
```

- [ ] **Step 2: Add the import**

Alongside the other `./` component imports in `Config.tsx`:

```ts
import { ConfigHomeMenu, describeActiveConfigHome } from './ConfigHomeMenu.js';
```

- [ ] **Step 3: Add the settings entry**

Immediately after the `language` entry (which ends at
`Config.tsx:1033`), insert:

```ts
  }, {
    id: 'configHome',
    label: 'Conversation & config folder',
    value: describeActiveConfigHome().path.endsWith('.claude')
      ? '~/.claude (shared with Claude Code)'
      : '~/.openclaude',
    type: 'managedEnum' as const,
    onChange: () => {} // handled by the ConfigHome submenu
```

- [ ] **Step 4: Open the submenu on selection**

In the `switch` that opens submenus (`Config.tsx:1672-1679`), add a case
next to `'language'`:

```ts
        case 'configHome':
          setShowSubmenu('ConfigHome');
          setTabsHidden(true);
          return;
```

- [ ] **Step 5: Render the submenu**

In the submenu render chain, add a branch next to the `'Language'` one
(`Config.tsx:1949`):

```tsx
        </> : showSubmenu === 'ConfigHome' ? <>
          <ConfigHomeMenu onComplete={(mode, migrated) => {
        isDirty.current = true;
        saveGlobalConfig(current => ({
          ...current,
          configHome: mode
        }));
        setGlobalConfig({
          ...getGlobalConfig(),
          configHome: mode
        });
        setShowSubmenu(null);
        setTabsHidden(false);
        void logEvent('tengu_config_home_changed', {
          mode: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          migrated: String(migrated) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} />
```

This is where the spec's `writeConfigHomePreference()` lives — inline
`saveGlobalConfig`, for the import-cycle reason in Global Constraints.

- [ ] **Step 6: Typecheck and run the settings suite**

Run:
```bash
bun run typecheck
bun test src/components/Settings/
```
Expected: typecheck clean; settings tests PASS.

- [ ] **Step 7: Run the whole affected surface**

Run:
```bash
bun test src/utils/configHome.test.ts \
  src/utils/configHome.resolution.test.ts \
  src/utils/configHomeMigration.plan.test.ts \
  src/utils/configHomeMigration.run.test.ts \
  src/utils/configHomeSuggestion.test.ts \
  src/utils/openclaudePaths.test.ts \
  src/utils/claudeConfigResolution.test.ts \
  src/components/Settings/ConfigHomeMenu.test.tsx \
  src/services/tips/tipScheduler.test.ts
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Settings/Config.tsx
git commit -m "feat(config): expose the conversation & config folder picker in /config"
```

---

## Manual verification

Automated tests cannot cover the restart-dependent path. After Task 7,
verify by hand:

1. `bun run build && node bin/openclaude`
2. `/config` → **Conversation & config folder** → confirm it reports the
   active directory and the reason.
3. Choose `~/.claude`, review the migration plan, run the copy.
4. Confirm `~/.openclaude/projects/` is byte-identical to before
   (`diff -r` against a copy taken beforehand).
5. Restart, run `/resume`, and confirm Claude Code's conversations appear.
6. Reopen `/config` and confirm the spinner tip no longer fires
   (a preference is now recorded).
