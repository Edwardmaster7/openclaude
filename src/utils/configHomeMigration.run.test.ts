import { describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
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

  test('is idempotent for settings.json: second run with no new keys creates no backup', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      // Source has bashSecurityLevel that destination doesn't have.
      writeFileSync(
        join(home, '.openclaude', 'settings.json'),
        JSON.stringify({ theme: 'dark', bashSecurityLevel: 'smart' }),
      )
      // Destination has only theme.
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        JSON.stringify({ theme: 'light' }),
      )

      const first = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )
      const second = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      // First run: destination wins on conflict (theme: 'light'), source key added (bashSecurityLevel: 'smart').
      // Merged result differs from destination, so a backup is created and settings are written.
      expect(first.copiedFiles).toBe(1)
      expect(first.settingsBackupPath).toBeDefined()
      const backups = readdirSync(join(home, '.claude', 'backups'))
      expect(backups.length).toBe(1)

      // Verify the merged settings contain both the destination's theme and source's bashSecurityLevel.
      const merged = JSON.parse(
        readFileSync(join(home, '.claude', 'settings.json'), 'utf8'),
      )
      expect(merged.theme).toBe('light')
      expect(merged.bashSecurityLevel).toBe('smart')

      // Second run: merged result is identical to existing destination, so no backup and no write.
      expect(second.copiedFiles).toBe(0)
      expect(second.settingsBackupPath).toBeUndefined()
      const backupsAfterSecond = readdirSync(join(home, '.claude', 'backups'))
      expect(backupsAfterSecond.length).toBe(1) // No new backup created
    })
  })

  test('merges history.jsonl in timestamp order without duplicating identical lines', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      // The OpenClaude entry is OLDER than the destination's newest entry, so a
      // naive append would leave it last — i.e. newest, since history.ts reads
      // this file in reverse for recency.
      const old = '{"display":"old-openclaude","timestamp":100}'
      const shared = '{"display":"shared","timestamp":200}'
      const recent = '{"display":"recent-claude","timestamp":300}'
      writeFileSync(
        join(home, '.openclaude', 'history.jsonl'),
        `${old}\n${shared}\n`,
      )
      writeFileSync(
        join(home, '.claude', 'history.jsonl'),
        `${shared}\n${recent}\n`,
      )

      await runConfigHomeMigration(planConfigHomeMigration({ homeDir: home }))

      const lines = readFileSync(join(home, '.claude', 'history.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
      // Chronological ascending, and `shared` appears exactly once.
      expect(lines).toEqual([old, shared, recent])
    })
  })

  test('copies CLAUDE.md and keybindings.json when absent at the destination', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      writeFileSync(join(home, '.openclaude', 'CLAUDE.md'), '# memory\n')
      writeFileSync(join(home, '.openclaude', 'keybindings.json'), '{"a":1}')

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(result.errors).toEqual([])
      expect(readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8')).toBe(
        '# memory\n',
      )
      expect(
        readFileSync(join(home, '.claude', 'keybindings.json'), 'utf8'),
      ).toBe('{"a":1}')
    })
  })

  test('never overwrites an existing CLAUDE.md or keybindings.json', async () => {
    await withTempHome(async home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(join(home, '.openclaude', 'CLAUDE.md'), '# openclaude\n')
      writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# claude\n')
      writeFileSync(join(home, '.openclaude', 'keybindings.json'), '{"a":1}')
      writeFileSync(join(home, '.claude', 'keybindings.json'), '{"b":2}')

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(result.errors).toEqual([])
      expect(readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8')).toBe(
        '# claude\n',
      )
      expect(
        readFileSync(join(home, '.claude', 'keybindings.json'), 'utf8'),
      ).toBe('{"b":2}')
    })
  })

  test('does not copy through a symlinked directory', async () => {
    await withTempHome(async home => {
      const outside = join(home, 'outside')
      mkdirSync(outside, { recursive: true })
      writeFileSync(join(outside, 'vault-note.md'), 'huge\n')

      const skills = join(home, '.openclaude', 'skills')
      mkdirSync(skills, { recursive: true })
      writeFileSync(join(skills, 'real.md'), 'real\n')
      symlinkSync(outside, join(skills, 'linked'), 'dir')

      const result = await runConfigHomeMigration(
        planConfigHomeMigration({ homeDir: home }),
      )

      expect(result.copiedFiles).toBe(1)
      expect(existsSync(join(home, '.claude', 'skills', 'real.md'))).toBe(true)
      expect(existsSync(join(home, '.claude', 'skills', 'linked'))).toBe(false)
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
