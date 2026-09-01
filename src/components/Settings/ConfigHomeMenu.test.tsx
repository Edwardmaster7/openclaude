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

  test('reports the existing-openclaude state when .openclaude has content and no preference was set', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      const described = describeActiveConfigHome({ homeDir: home })
      expect(described.reason).toBe('existing-openclaude')
      expect(described.path).toBe(join(home, '.openclaude'))
    })
  })

  test('reports the existing-openclaude state when both .openclaude and .claude exist and no preference was set', () => {
    withTempHome(home => {
      mkdirSync(join(home, '.openclaude'), { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      expect(describeActiveConfigHome({ homeDir: home }).reason).toBe(
        'existing-openclaude',
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
