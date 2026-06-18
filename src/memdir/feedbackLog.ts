import { join } from 'path'
import { getFsImplementation } from '../utils/fsOperations.js'
import { getAutoMemPath } from './paths.js'

export type FeedbackEvent = {
  ts: string
  session: string
  type: 'undo' | 'correction' | 'outcome'
  tool?: string
  file?: string
  context?: string
  original?: string
  correction?: string
  success?: boolean
  error?: string
  confirmed?: boolean
}

export function getFeedbackLogPath(): string {
  return join(getAutoMemPath(), 'feedback-log.jsonl')
}

export async function logFeedbackEvent(
  event: Omit<FeedbackEvent, 'ts' | 'session'>,
  sessionId?: string,
): Promise<void> {
  const fs = getFsImplementation()
  const logPath = getFeedbackLogPath()
  
  const fullEvent: FeedbackEvent = {
    ts: new Date().toISOString(),
    session: sessionId || 'default',
    ...event,
  }
  
  // Ensure the parent directory exists
  try {
    const parentDir = getAutoMemPath()
    await fs.mkdir(parentDir)
  } catch {
    // Parent directory exists or failed to create
  }

  const logLine = JSON.stringify(fullEvent) + '\n'
  try {
    fs.appendFileSync(logPath, logLine, { encoding: 'utf8' } as any)
  } catch (error) {
    // If append fails, silently catch or log to debug
  }
}

export async function readFeedbackEvents(): Promise<FeedbackEvent[]> {
  const fs = getFsImplementation()
  const logPath = getFeedbackLogPath()
  try {
    const content = await fs.readFile(logPath, { encoding: 'utf8' })
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as FeedbackEvent)
  } catch {
    return []
  }
}

export async function clearFeedbackLog(keepLast = 50): Promise<void> {
  const events = await readFeedbackEvents()
  if (events.length <= keepLast) {
    return
  }
  const remainingEvents = events.slice(-keepLast)
  const fs = getFsImplementation()
  const logPath = getFeedbackLogPath()
  const logContent = remainingEvents.map(e => JSON.stringify(e)).join('\n') + '\n'
  try {
    // Atomic or simple write
    fs.appendFileSync(logPath, '', { mode: 0o666 }) // trigger create if not exist
    // We can write it via standard write methods or writeTextContent equivalents
    // FsOperations doesn't expose a sync writeFile, but we can write via NodeFs or append
    // Wait, let's write to it using Bun/Node fs or unlinking and appending.
    // If we unlink and then appendFileSync, it's very simple.
    try {
      await fs.unlink(logPath)
    } catch {
      // Ignore
    }
    fs.appendFileSync(logPath, logContent, { encoding: 'utf8' } as any)
  } catch {
    // Silent catch
  }
}

export async function resetFeedbackLog(): Promise<void> {
  const fs = getFsImplementation()
  const logPath = getFeedbackLogPath()
  try {
    await fs.unlink(logPath)
  } catch {
    // Ignore
  }
}
