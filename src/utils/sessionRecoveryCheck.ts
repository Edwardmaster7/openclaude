import { getActiveSessionLock, type ActiveSessionState } from './sessionLock.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function isProcessRunning(pid: number): boolean {
  if (pid <= 0) return false
  if (pid === process.pid) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'EPERM') {
      return true
    }
    return false
  }
}

export async function checkCrashRecoveryCandidate(
  projectDir: string,
): Promise<ActiveSessionState | null> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return null
  if (state.cleanExit) return null
  if (isProcessRunning(state.pid)) return null
  if (Date.now() - state.lastUpdatedAt > SEVEN_DAYS_MS) return null

  return state
}
