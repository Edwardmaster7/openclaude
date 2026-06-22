import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Import the config module
const configPath = path.resolve(__dirname, '../../plugins/stoneage/src/hooks/stoneage-config.js')

describe('Stoneage Config', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoneage-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('VALID_MODES contains all expected modes', () => {
    const config = require(configPath)
    expect(config.VALID_MODES).toEqual(['off', 'lite', 'full', 'ultra'])
  })

  test('getDefaultMode returns full by default', () => {
    const config = require(configPath)
    const mode = config.getDefaultMode()
    expect(mode).toBe('full')
  })

  test('getDefaultMode reads from STONEAGE_DEFAULT_MODE env', () => {
    const original = process.env.STONEAGE_DEFAULT_MODE
    try {
      process.env.STONEAGE_DEFAULT_MODE = 'lite'
      // Re-require to get fresh module
      delete require.cache[require.resolve(configPath)]
      const config = require(configPath)
      expect(config.getDefaultMode()).toBe('lite')
    } finally {
      if (original) process.env.STONEAGE_DEFAULT_MODE = original
      else delete process.env.STONEAGE_DEFAULT_MODE
    }
  })

  test('getDefaultMode ignores invalid env value', () => {
    const original = process.env.STONEAGE_DEFAULT_MODE
    try {
      process.env.STONEAGE_DEFAULT_MODE = 'invalid'
      delete require.cache[require.resolve(configPath)]
      const config = require(configPath)
      expect(config.getDefaultMode()).toBe('full')
    } finally {
      if (original) process.env.STONEAGE_DEFAULT_MODE = original
      else delete process.env.STONEAGE_DEFAULT_MODE
    }
  })

  test('safeWriteFlag creates flag file', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    config.safeWriteFlag(flagPath, 'full')
    expect(fs.existsSync(flagPath)).toBe(true)
    expect(fs.readFileSync(flagPath, 'utf8')).toBe('full')
  })

  test('safeWriteFlag sets 0600 permissions', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    config.safeWriteFlag(flagPath, 'lite')
    const stat = fs.statSync(flagPath)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  test('readFlag reads valid mode', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    fs.writeFileSync(flagPath, 'ultra')
    expect(config.readFlag(flagPath)).toBe('ultra')
  })

  test('readFlag returns null for invalid mode', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    fs.writeFileSync(flagPath, 'invalid')
    expect(config.readFlag(flagPath)).toBeNull()
  })

  test('readFlag returns null for missing file', () => {
    const config = require(configPath)
    expect(config.readFlag(path.join(tempDir, 'nonexistent'))).toBeNull()
  })

  test('readFlag returns null for symlink', () => {
    const config = require(configPath)
    const realPath = path.join(tempDir, 'real')
    const linkPath = path.join(tempDir, 'link')
    fs.writeFileSync(realPath, 'full')
    fs.symlinkSync(realPath, linkPath)
    expect(config.readFlag(linkPath)).toBeNull()
  })

  test('readFlag caps at 64 bytes', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    // 64 bytes of garbage — sanitization strips non-alphanumeric, result is not a valid mode
    fs.writeFileSync(flagPath, 'x'.repeat(100))
    expect(config.readFlag(flagPath)).toBeNull()
  })

  test('readFlag handles exactly 64 bytes with valid mode', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    // Exactly 64 bytes: 'ultra' padded with spaces
    fs.writeFileSync(flagPath, 'ultra' + ' '.repeat(59))
    expect(config.readFlag(flagPath)).toBe('ultra')
  })

  test('clearFlag removes flag file', () => {
    const config = require(configPath)
    const flagPath = path.join(tempDir, 'test-flag')
    fs.writeFileSync(flagPath, 'full')
    expect(fs.existsSync(flagPath)).toBe(true)
    config.clearFlag(flagPath)
    expect(fs.existsSync(flagPath)).toBe(false)
  })

  test('clearFlag does not throw on missing file', () => {
    const config = require(configPath)
    expect(() => config.clearFlag(path.join(tempDir, 'nonexistent'))).not.toThrow()
  })
})
