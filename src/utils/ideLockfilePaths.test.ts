import { describe, expect, test } from 'bun:test'
import { homedir } from 'os'
import { join } from 'path'
import { getIdeLockfilesPaths } from './ide.js'

describe('getIdeLockfilesPaths', () => {
  test('returns both .claude/ide and .openclaude/ide directories', async () => {
    const paths = await getIdeLockfilesPaths()
    const home = homedir()

    expect(paths).toContain(join(home, '.claude', 'ide'))
    expect(paths).toContain(join(home, '.openclaude', 'ide'))
  })
})
