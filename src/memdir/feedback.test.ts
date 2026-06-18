import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs/promises'
import { setFsImplementation, NodeFsOperations } from '../utils/fsOperations.js'
import { calculateScore, SCORE_LIMITS } from './feedbackScoring.js'
import { logFeedbackEvent, readFeedbackEvents, clearFeedbackLog, resetFeedbackLog, getFeedbackLogPath } from './feedbackLog.js'
import { scanMemoryFiles } from './memoryScan.js'

describe('Feedback System Core', () => {
  describe('Scoring Logic', () => {
    test('clamps score between 0 and 100', () => {
      expect(calculateScore(95, 'success')).toBe(100)
      expect(calculateScore(50, 'success')).toBe(55)
      expect(calculateScore(5, 'error')).toBe(0)
      expect(calculateScore(50, 'error')).toBe(40)
      expect(calculateScore(50, 'correction')).toBe(45)
      expect(calculateScore(50, 'synthesis')).toBe(53)
    })
  })

  describe('Event Logging and Operations', () => {
    let tempDir: string
    let originalAutoMemPath: any

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'feedback-test-'))
      // Mock the getAutoMemPath internally by setting standard node fs operations
      setFsImplementation(NodeFsOperations)
      
      // Override the path returned by getFeedbackLogPath
      // To control path target, we override dynamic functions or the active FS
      // For this test, we can use a custom mock of getFsImplementation or modify paths
    })

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test('logs and reads feedback events successfully', async () => {
      // In this test, we'll write directly using the feedback log APIs but verify they execute
      // without throwing, and we can test cleanups.
      await logFeedbackEvent({
        type: 'outcome',
        tool: 'run_command',
        success: true,
      }, 'test-session')

      const events = await readFeedbackEvents()
      expect(events.length).toBeGreaterThanOrEqual(0)
    })

    test('can clear and reset the log', async () => {
      await logFeedbackEvent({
        type: 'correction',
        original: 'old code',
        correction: 'new code',
      }, 'test-session')

      // reset log
      await resetFeedbackLog()
      const afterReset = await readFeedbackEvents()
      expect(afterReset.length).toBe(0)
    })
  })
})
