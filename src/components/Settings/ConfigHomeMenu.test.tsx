import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  describeActiveConfigHome,
  preserveConfigHomeOnRevert,
} from './ConfigHomeMenu.js'

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

describe('preserveConfigHomeOnRevert', () => {
  // Regression: /config's Esc path does saveGlobalConfig(() => initialConfig
  // .current), a full overwrite from the dialog's mount-time snapshot. The
  // config-home choice is committed before that runs (its migration copy has
  // already happened and cannot be rolled back), so a plain snapshot restore
  // silently un-chose the folder — files copied, app still on the old dir.
  test('keeps a choice the snapshot predates', () => {
    expect(
      preserveConfigHomeOnRevert({ configHome: undefined }, {
        configHome: 'claude',
      }).configHome,
    ).toBe('claude')
  })

  test('keeps a choice that replaced an earlier one', () => {
    expect(
      preserveConfigHomeOnRevert({ configHome: 'openclaude' }, {
        configHome: 'claude',
      }).configHome,
    ).toBe('claude')
  })

  test('reverts every other key to the snapshot', () => {
    const reverted = preserveConfigHomeOnRevert(
      { theme: 'dark', configHome: undefined },
      { theme: 'light', configHome: 'claude' },
    )
    expect(reverted.theme).toBe('dark')
    expect(reverted.configHome).toBe('claude')
  })

  test('leaves an unset preference unset', () => {
    expect(
      preserveConfigHomeOnRevert({ configHome: undefined }, {
        configHome: undefined,
      }).configHome,
    ).toBeUndefined()
  })
})
