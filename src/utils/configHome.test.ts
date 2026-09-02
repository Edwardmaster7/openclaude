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
