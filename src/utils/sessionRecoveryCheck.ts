import { createInterface } from 'node:readline'
import { getActiveSessionLock, markCleanExit, type ActiveSessionState } from './sessionLock.js'
import { getGlobalConfig } from './config.js'

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

export async function promptCrashRecoveryUser(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return 'no'
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} `, resolve)
    })
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function handleCrashRecoveryCheck(
  projectDir: string,
  options: {
    promptFn?: (question: string) => Promise<string>
  } = {},
): Promise<string | null> {
  const config = getGlobalConfig()
  const mode = config.autoResumeOnCrash ?? 'prompt'
  if (mode === 'never') {
    return null
  }

  const candidate = await checkCrashRecoveryCandidate(projectDir)
  if (!candidate) {
    return null
  }

  if (mode === 'always') {
    return candidate.sessionId
  }

  if (mode === 'prompt') {
    const prompt = options.promptFn ?? promptCrashRecoveryUser
    const question = `Sessão anterior interrompida encontrada (ID: ${candidate.sessionId}). Voltar para a sessão interrompida? (Sim / Não)`
    const answer = await prompt(question)
    const lower = answer.toLowerCase().trim()
    if (lower === 's' || lower === 'sim' || lower === 'y' || lower === 'yes') {
      return candidate.sessionId
    } else {
      await markCleanExit(projectDir)
      return null
    }
  }

  return null
}

