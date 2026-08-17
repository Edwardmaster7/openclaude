import { describe, expect, test } from 'bun:test'
import packageJson from '../../package.json'

describe('package.json bin configuration', () => {
  test('has correct native binary shortcuts', () => {
    expect(packageJson.bin).toBeDefined()
    expect(packageJson.bin.openclaude).toBe('./bin/openclaude')
    expect(packageJson.bin.oc).toBe('./bin/openclaude')
  })
})
