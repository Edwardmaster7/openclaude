import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface ActiveSessionState {
  sessionId: string
  startedAt: number
  lastUpdatedAt: number
  pid: number
  cleanExit: boolean
}

function getLockFilePath(projectDir: string): string {
  return join(projectDir, 'active-session.json')
}

const activeLockProjectDirs = new Set<string>()

export async function saveActiveSessionLock(
  sessionId: string,
  projectDir: string,
): Promise<void> {
  activeLockProjectDirs.add(projectDir)
  await mkdir(projectDir, { recursive: true })
  const state: ActiveSessionState = {
    sessionId,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    pid: process.pid,
    cleanExit: false,
  }
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function markAllCleanExit(): Promise<void> {
  for (const dir of Array.from(activeLockProjectDirs)) {
    await markCleanExit(dir)
  }
}

export async function updateSessionLockTimestamp(projectDir: string): Promise<void> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return
  state.lastUpdatedAt = Date.now()
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function markCleanExit(projectDir: string): Promise<void> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return
  state.cleanExit = true
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function getActiveSessionLock(
  projectDir: string,
): Promise<ActiveSessionState | null> {
  try {
    const data = await readFile(getLockFilePath(projectDir), 'utf-8')
    return JSON.parse(data) as ActiveSessionState
  } catch {
    return null
  }
}
