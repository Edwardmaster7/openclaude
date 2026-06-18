import type { Message } from '../types/message.js'
import { logFeedbackEvent } from '../memdir/feedbackLog.js'

export type FeedbackDetectionResult = {
  detected: boolean
  type: 'correction' | 'undo'
  file?: string
  message: string
  originalText?: string
}

const UNDO_PATTERNS = [
  /\bdesfaz(er)?\b/i,
  /\bdesfiz\b/i,
  /\bundo\b/i,
  /\brevert(er)?\b/i,
  /\brollback\b/i,
  /\bgit\s+checkout\b/i,
  /\bgit\s+restore\b/i,
]

const CORRECTION_PATTERNS = [
  /\bnão,?\s+faz\s+assim\b/i,
  /\bnão\s+era\s+isso\b/i,
  /\btroca\b.*\bpor\b/i,
  /\buse\b.*\bem\s+vez\b/i,
  /\bprefer\w*\b.*\binstead\b/i,
]

/**
 * Extracts recently modified file paths from the assistant's previous turns in this session.
 */
export function extractLastEditedFiles(messages: Message[]): string[] {
  const files: string[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.type === 'assistant' && msg.content && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (
          block.type === 'tool_use' &&
          (block.name === 'FileWriteTool' ||
            block.name === 'FileEditTool' ||
            block.name === 'Write' ||
            block.name === 'Edit')
        ) {
          const input = block.input as { file_path?: string; path?: string }
          const path = input.file_path || input.path
          if (path) {
            files.push(path)
          }
        }
      }
    }
    // Stop scanning when hitting the user's previous message turn
    if (msg?.type === 'user') {
      break
    }
  }
  return [...new Set(files)]
}

// ─── Last detected feedback (module-level, consumed by observer) ────────
let lastDetectedFeedback: FeedbackDetectionResult | null = null

export function getLastDetectedFeedback(): FeedbackDetectionResult | null {
  return lastDetectedFeedback
}

export function clearLastDetectedFeedback(): void {
  lastDetectedFeedback = null
}

/**
 * Inspects a user message for corrections or undos, logs the event, and returns a proposal notice if a pattern is matched.
 */
export async function detectAndLogFeedback(
  input: string,
  messages: Message[],
  sessionId?: string,
): Promise<FeedbackDetectionResult | null> {
  if (!input || !messages) return null

  const lastEditedFiles = extractLastEditedFiles(messages)
  const lowerInput = input.toLowerCase()

  // 1. Check for Undo/Revert
  let isUndo = false
  for (const pattern of UNDO_PATTERNS) {
    if (pattern.test(input)) {
      isUndo = true
      break
    }
  }

  const matchedFile = lastEditedFiles.find(file => {
    const base = file.split('/').pop() || ''
    return lowerInput.includes(base.toLowerCase()) || lowerInput.includes(file.toLowerCase())
  })

  if (isUndo) {
    const file = matchedFile || 'unknown'
    await logFeedbackEvent(
      {
        type: 'undo',
        tool: 'Edit',
        file,
        context: input,
      },
      sessionId,
    )

    if (matchedFile) {
      lastDetectedFeedback = {
        detected: true,
        type: 'undo' as const,
        file: matchedFile,
        message: `[Feedback System] Notei que você desfez minha edição em \`${matchedFile}\`. Quer que eu salve isso como um padrão aprendido? Use "/feedback confirm" para registrar ou ignore.`,
      }
      return lastDetectedFeedback
    }
  }

  // 2. Check for Explicit Correction
  let isCorrection = false
  for (const pattern of CORRECTION_PATTERNS) {
    if (pattern.test(input)) {
      isCorrection = true
      break
    }
  }

  if (isCorrection || (isUndo && !matchedFile)) {
    let originalText = ''
    const lastAssistant = [...messages].reverse().find(m => m.type === 'assistant')
    if (lastAssistant && lastAssistant.content) {
      originalText =
        typeof lastAssistant.content === 'string'
          ? lastAssistant.content
          : JSON.stringify(lastAssistant.content)
    }

    await logFeedbackEvent(
      {
        type: 'correction',
        original: originalText.substring(0, 200),
        correction: input,
      },
      sessionId,
    )

    lastDetectedFeedback = {
      detected: true,
      type: 'correction' as const,
      originalText,
      message: `[Feedback System] Notei uma correção: "${input}". Quer que eu salve isso como um padrão aprendido? Use "/feedback confirm" para registrar ou ignore.`,
    }
    return lastDetectedFeedback
  }

  return null
}
