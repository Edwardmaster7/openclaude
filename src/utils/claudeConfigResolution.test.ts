import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getOriginalCwd, setOriginalCwd } from '../bootstrap/state.js'
import { clearMemoryFileCaches, getMemoryFiles } from './claudemd.js'
import { resolveConfigDirEnv, resolveClaudeConfigHomeDir } from './envUtils.js'
import {
  loadMarkdownFilesForSubdir,
  PROJECT_CONFIG_DIR_NAMES,
} from './markdownConfigLoader.js'
import { resetSettingsCache } from './settings/settingsCache.js'
import { getSettingsForSource as getSettings } from './settings/settings.js'

describe('Claude Config Resolution & Merging (.claude and .openclaude)', () => {
  const tempDir = join(homedir(), `.tmp_test_claude_${Date.now()}`)

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true })
    resetSettingsCache()
    clearMemoryFileCaches()
    loadMarkdownFilesForSubdir.cache?.clear?.()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.OPENCLAUDE_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR
    resetSettingsCache()
    clearMemoryFileCaches()
    loadMarkdownFilesForSubdir.cache?.clear?.()
  })

  test('PROJECT_CONFIG_DIR_NAMES includes both .openclaude and .claude in correct order', () => {
    expect(PROJECT_CONFIG_DIR_NAMES).toEqual(['.openclaude', '.claude'])
  })

  test('resolveConfigDirEnv respects OPENCLAUDE_CONFIG_DIR > CLAUDE_CONFIG_DIR priority', () => {
    expect(
      resolveConfigDirEnv({
        openClaudeConfigDir: '/custom/openclaude',
        legacyConfigDir: '/custom/claude',
      }),
    ).toBe('/custom/openclaude')

    expect(
      resolveConfigDirEnv({
        legacyConfigDir: '/custom/claude',
      }),
    ).toBe('/custom/claude')
  })

  test('resolveClaudeConfigHomeDir falls back to ~/.claude when ~/.openclaude does not exist', () => {
    const fakeHome = join(tempDir, 'fake_home')
    const claudeDir = join(fakeHome, '.claude')
    mkdirSync(claudeDir, { recursive: true })

    const resolved = resolveClaudeConfigHomeDir({ homeDir: fakeHome })
    expect(resolved).toBe(claudeDir)
  })

  test('resolveClaudeConfigHomeDir defaults a clean install to ~/.claude', () => {
    const fakeHome = join(tempDir, 'clean_home')
    mkdirSync(fakeHome, { recursive: true })
    // Neither ~/.openclaude nor ~/.claude exists: a brand-new install
    // shares Claude Code's directory.
    expect(resolveClaudeConfigHomeDir({ homeDir: fakeHome })).toBe(
      join(fakeHome, '.claude'),
    )
  })

  test('loadMarkdownFilesForSubdir discovers commands from both .openclaude/commands and .claude/commands', async () => {
    const projDir = join(tempDir, 'project')
    const openClaudeCmdDir = join(projDir, '.openclaude', 'commands')
    const claudeCmdDir = join(projDir, '.claude', 'commands')

    mkdirSync(openClaudeCmdDir, { recursive: true })
    mkdirSync(claudeCmdDir, { recursive: true })

    writeFileSync(
      join(openClaudeCmdDir, 'open_cmd.md'),
      '---\ndescription: Open command\n---\nOpen content',
    )
    writeFileSync(
      join(claudeCmdDir, 'claude_cmd.md'),
      '---\ndescription: Claude command\n---\nClaude content',
    )

    const files = await loadMarkdownFilesForSubdir('commands', projDir)
    const fileNames = files.map(f => f.filePath)

    expect(fileNames.some(p => p.includes('open_cmd.md'))).toBe(true)
    expect(fileNames.some(p => p.includes('claude_cmd.md'))).toBe(true)
  })

  test('getSettings merges .claude/settings.json and .openclaude/settings.json with .openclaude overriding', () => {
    const projDir = join(tempDir, 'proj_settings')
    const openClaudeDir = join(projDir, '.openclaude')
    const claudeDir = join(projDir, '.claude')

    mkdirSync(openClaudeDir, { recursive: true })
    mkdirSync(claudeDir, { recursive: true })

    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ model: 'claude-3-5-sonnet', cleanupPeriodHours: 24 }),
    )
    writeFileSync(
      join(openClaudeDir, 'settings.json'),
      JSON.stringify({ cleanupPeriodHours: 48 }),
    )

    const prevCwd = getOriginalCwd()
    try {
      setOriginalCwd(projDir)
      resetSettingsCache()

      const merged = getSettings('projectSettings')
      expect(merged).not.toBeNull()
      expect(merged?.model).toBe('claude-3-5-sonnet')
      expect(merged?.cleanupPeriodHours).toBe(48)
    } finally {
      setOriginalCwd(prevCwd)
    }
  })

  test('getMemoryFiles processes rules from both .openclaude/rules and .claude/rules', async () => {
    const projDir = join(tempDir, 'proj_rules')
    const openClaudeRules = join(projDir, '.openclaude', 'rules')
    const claudeRules = join(projDir, '.claude', 'rules')

    mkdirSync(openClaudeRules, { recursive: true })
    mkdirSync(claudeRules, { recursive: true })

    writeFileSync(join(openClaudeRules, 'rule1.md'), 'OpenClaude Rule Content')
    writeFileSync(join(claudeRules, 'rule2.md'), 'Claude Rule Content')

    const prevCwd = getOriginalCwd()
    try {
      setOriginalCwd(projDir)
      clearMemoryFileCaches()
      const memoryResult = await getMemoryFiles()
      const contents = memoryResult.map(f => f.content)

      expect(contents.some(c => c.includes('OpenClaude Rule Content'))).toBe(true)
      expect(contents.some(c => c.includes('Claude Rule Content'))).toBe(true)
    } finally {
      setOriginalCwd(prevCwd)
    }
  })
})
