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
