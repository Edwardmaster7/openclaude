import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkCrashRecoveryCandidate } from './sessionRecoveryCheck.js'
import type { ActiveSessionState } from './sessionLock.js'

describe('checkCrashRecoveryCandidate', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'recovery-check-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('returns null when no active-session.json exists', async () => {
    const result = await checkCrashRecoveryCandidate(tempDir)
    expect(result).toBeNull()
  })

  test('returns null when cleanExit is true', async () => {
    const state: ActiveSessionState = {
      sessionId: 'sess-1',
      startedAt: Date.now() - 1000,
      lastUpdatedAt: Date.now() - 500,
      pid: 999999,
      cleanExit: true,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(state), 'utf-8')

    const result = await checkCrashRecoveryCandidate(tempDir)
    expect(result).toBeNull()
  })

  test('returns null when pid equals current process.pid', async () => {
    const state: ActiveSessionState = {
      sessionId: 'sess-2',
      startedAt: Date.now() - 1000,
      lastUpdatedAt: Date.now() - 500,
      pid: process.pid,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(state), 'utf-8')

    const result = await checkCrashRecoveryCandidate(tempDir)
    expect(result).toBeNull()
  })

  test('returns null when lastUpdatedAt is older than 7 days', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    const state: ActiveSessionState = {
      sessionId: 'sess-3',
      startedAt: eightDaysAgo - 1000,
      lastUpdatedAt: eightDaysAgo,
      pid: 999999,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(state), 'utf-8')

    const result = await checkCrashRecoveryCandidate(tempDir)
    expect(result).toBeNull()
  })

  test('returns state object when candidate is valid interrupted session', async () => {
    const state: ActiveSessionState = {
      sessionId: 'sess-4',
      startedAt: Date.now() - 3600000,
      lastUpdatedAt: Date.now() - 60000,
      pid: 999999,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(state), 'utf-8')

    const result = await checkCrashRecoveryCandidate(tempDir)
    expect(result).toEqual(state)
  })
})
