import { describe, expect, test } from 'bun:test'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
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

  test('plans CLAUDE.md and keybindings.json when absent at the destination', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      writeFileSync(join(home, '.openclaude', 'CLAUDE.md'), '# memory\n')
      writeFileSync(
        join(home, '.openclaude', 'keybindings.json'),
        JSON.stringify({ bindings: [] }),
      )

      const plan = planConfigHomeMigration({ homeDir: home })

      expect(plan.surfaces.find(s => s.name === 'CLAUDE.md')).toEqual({
        name: 'CLAUDE.md',
        fileCount: 1,
        skippedCount: 0,
      })
      expect(plan.surfaces.find(s => s.name === 'keybindings.json')).toEqual({
        name: 'keybindings.json',
        fileCount: 1,
        skippedCount: 0,
      })
      expect(plan.totalFilesToCopy).toBe(2)
    })
  })

  test('marks CLAUDE.md and keybindings.json skipped when already at the destination', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(join(home, '.openclaude', 'CLAUDE.md'), '# openclaude\n')
      writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# claude\n')
      writeFileSync(join(home, '.openclaude', 'keybindings.json'), '{}')
      writeFileSync(join(home, '.claude', 'keybindings.json'), '{}')

      const plan = planConfigHomeMigration({ homeDir: home })

      expect(plan.surfaces.find(s => s.name === 'CLAUDE.md')).toEqual({
        name: 'CLAUDE.md',
        fileCount: 0,
        skippedCount: 1,
      })
      expect(plan.surfaces.find(s => s.name === 'keybindings.json')).toEqual({
        name: 'keybindings.json',
        fileCount: 0,
        skippedCount: 1,
      })
      expect(plan.totalFilesToCopy).toBe(0)
    })
  })

  test('includes the rules and teams directory surfaces', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude', 'rules'), { recursive: true })
      mkdirSync(join(home, '.openclaude', 'teams'), { recursive: true })
      writeFileSync(join(home, '.openclaude', 'rules', 'a.md'), 'rule\n')
      writeFileSync(join(home, '.openclaude', 'teams', 'b.json'), '{}')

      const plan = planConfigHomeMigration({ homeDir: home })

      expect(plan.surfaces.find(s => s.name === 'rules')?.fileCount).toBe(1)
      expect(plan.surfaces.find(s => s.name === 'teams')?.fileCount).toBe(1)
    })
  })

  test('skips a symlinked directory instead of recursing into it', () => {
    withTempHome(home => {
      const outside = join(home, 'outside')
      mkdirSync(outside, { recursive: true })
      writeFileSync(join(outside, 'vault-note.md'), 'huge\n')

      const skills = join(home, '.openclaude', 'skills')
      mkdirSync(skills, { recursive: true })
      writeFileSync(join(skills, 'real.md'), 'real\n')
      symlinkSync(outside, join(skills, 'linked'), 'dir')

      const plan = planConfigHomeMigration({ homeDir: home })

      // Only the real file counts; the symlinked tree is not followed.
      expect(plan.surfaces.find(s => s.name === 'skills')?.fileCount).toBe(1)
    })
  })

  test('an absent source directory yields an empty plan, not an error', () => {
    withTempHome(home => {
      const plan = planConfigHomeMigration({ homeDir: home })
      expect(plan.totalFilesToCopy).toBe(0)
    })
  })
})
