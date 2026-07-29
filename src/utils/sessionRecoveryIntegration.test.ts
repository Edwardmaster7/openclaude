import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  saveActiveSessionLock,
  updateSessionLockTimestamp,
  markCleanExit,
  getActiveSessionLock,
} from './sessionLock.js'
import {
  checkCrashRecoveryCandidate,
  handleCrashRecoveryCheck,
} from './sessionRecoveryCheck.js'
import { runCleanupFunctions } from './cleanupRegistry.js'
import { switchSession, getSessionId, resetStateForTests } from '../bootstrap/state.js'
import { initSessionLock } from './sessionStorage.js'

describe('sessionRecoveryIntegration', () => {
  let tempDir: string

  beforeEach(async () => {
    resetStateForTests()
    tempDir = await mkdtemp(join(tmpdir(), 'session-recovery-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('creates active session lock on init and updates on switchSession', async () => {
    const sessionId1 = getSessionId()
    await initSessionLock(sessionId1, tempDir)

    const lock1 = await getActiveSessionLock(tempDir)
    expect(lock1).not.toBeNull()
    expect(lock1?.sessionId).toBe(sessionId1)
    expect(lock1?.cleanExit).toBe(false)
    expect(lock1?.pid).toBe(process.pid)

    const sessionId2 = 'test-session-2222'
    switchSession(sessionId2 as any)
    await initSessionLock(sessionId2, tempDir)

    const lock2 = await getActiveSessionLock(tempDir)
    expect(lock2).not.toBeNull()
    expect(lock2?.sessionId).toBe(sessionId2)
    expect(lock2?.cleanExit).toBe(false)
  })

  test('updates session lock timestamp on heartbeat update', async () => {
    const sessionId = getSessionId()
    await saveActiveSessionLock(sessionId, tempDir)

    const initialLock = await getActiveSessionLock(tempDir)
    expect(initialLock).not.toBeNull()

    // Wait a brief moment to ensure timestamp change
    await new Promise(resolve => setTimeout(resolve, 20))

    await updateSessionLockTimestamp(tempDir)

    const updatedLock = await getActiveSessionLock(tempDir)
    expect(updatedLock).not.toBeNull()
    expect(updatedLock!.lastUpdatedAt).toBeGreaterThanOrEqual(initialLock!.lastUpdatedAt)
  })

  test('marks clean exit on graceful shutdown cleanup', async () => {
    const sessionId = getSessionId()
    await initSessionLock(sessionId, tempDir)

    const lockBefore = await getActiveSessionLock(tempDir)
    expect(lockBefore?.cleanExit).toBe(false)

    await runCleanupFunctions()

    const lockAfter = await getActiveSessionLock(tempDir)
    expect(lockAfter?.cleanExit).toBe(true)
  })

  test('detects crash recovery candidate when process is non-existent and exit was dirty', async () => {
    const crashedSessionId = 'crashed-session-9999'
    const deadPid = 999999 // Assumed non-existent PID

    const fakeLock = {
      sessionId: crashedSessionId,
      startedAt: Date.now() - 5000,
      lastUpdatedAt: Date.now() - 1000,
      pid: deadPid,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(fakeLock, null, 2), 'utf-8')

    const candidate = await checkCrashRecoveryCandidate(tempDir)
    expect(candidate).not.toBeNull()
    expect(candidate?.sessionId).toBe(crashedSessionId)
  })

  test('handleCrashRecoveryCheck prompt accepts "Sim" and resumes candidate', async () => {
    const crashedSessionId = 'crashed-session-prompt-yes'
    const deadPid = 999999

    const fakeLock = {
      sessionId: crashedSessionId,
      startedAt: Date.now() - 5000,
      lastUpdatedAt: Date.now() - 1000,
      pid: deadPid,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(fakeLock, null, 2), 'utf-8')

    const promptFn = async (_q: string) => 'Sim'
    const recoveredId = await handleCrashRecoveryCheck(tempDir, { promptFn })
    expect(recoveredId).toBe(crashedSessionId)
  })

  test('handleCrashRecoveryCheck prompt rejects "Não", marks clean exit, and returns null', async () => {
    const crashedSessionId = 'crashed-session-prompt-no'
    const deadPid = 999999

    const fakeLock = {
      sessionId: crashedSessionId,
      startedAt: Date.now() - 5000,
      lastUpdatedAt: Date.now() - 1000,
      pid: deadPid,
      cleanExit: false,
    }
    await writeFile(join(tempDir, 'active-session.json'), JSON.stringify(fakeLock, null, 2), 'utf-8')

    const promptFn = async (_q: string) => 'Não'
    const recoveredId = await handleCrashRecoveryCheck(tempDir, { promptFn })
    expect(recoveredId).toBeNull()

    const lockAfter = await getActiveSessionLock(tempDir)
    expect(lockAfter?.cleanExit).toBe(true)
  })
})
