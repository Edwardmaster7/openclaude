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
