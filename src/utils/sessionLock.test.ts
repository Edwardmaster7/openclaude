import { expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import {
  saveActiveSessionLock,
  updateSessionLockTimestamp,
  markCleanExit,
  getActiveSessionLock,
  type ActiveSessionState,
} from './sessionLock.js'

const TEST_DIR = join(import.meta.dirname, '../../test-tmp-session-lock')

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

test('creates active session lock file with cleanExit false', async () => {
  await saveActiveSessionLock('test-session-123', TEST_DIR)
  const lock = await getActiveSessionLock(TEST_DIR)

  expect(lock).not.toBeNull()
  expect(lock?.sessionId).toBe('test-session-123')
  expect(lock?.pid).toBe(process.pid)
  expect(lock?.cleanExit).toBe(false)
  expect(typeof lock?.startedAt).toBe('number')
  expect(typeof lock?.lastUpdatedAt).toBe('number')
})

test('updates session lock timestamp', async () => {
  await saveActiveSessionLock('test-session-123', TEST_DIR)
  const lockInitial = await getActiveSessionLock(TEST_DIR)
  expect(lockInitial).not.toBeNull()

  // Wait a small bit or force timestamp check
  await new Promise((resolve) => setTimeout(resolve, 10))
  await updateSessionLockTimestamp(TEST_DIR)

  const lockUpdated = await getActiveSessionLock(TEST_DIR)
  expect(lockUpdated).not.toBeNull()
  expect(lockUpdated!.lastUpdatedAt).toBeGreaterThanOrEqual(lockInitial!.lastUpdatedAt)
})

test('marks clean exit on shutdown', async () => {
  await saveActiveSessionLock('test-session-123', TEST_DIR)
  await markCleanExit(TEST_DIR)

  const lock = await getActiveSessionLock(TEST_DIR)
  expect(lock).not.toBeNull()
  expect(lock?.cleanExit).toBe(true)
})

test('returns null when active session file does not exist', async () => {
  const lock = await getActiveSessionLock(join(TEST_DIR, 'nonexistent'))
  expect(lock).toBeNull()
})

test('handles updateSessionLockTimestamp gracefully when file does not exist', async () => {
  await expect(updateSessionLockTimestamp(join(TEST_DIR, 'nonexistent'))).resolves.toBeUndefined()
})

test('handles markCleanExit gracefully when file does not exist', async () => {
  await expect(markCleanExit(join(TEST_DIR, 'nonexistent'))).resolves.toBeUndefined()
})
