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
