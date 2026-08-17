import { describe, expect, test } from 'bun:test'
import { getGlobalConfig } from './config.js'

describe('config', () => {
  test('autoResumeOnCrash defaults to prompt', () => {
    const config = getGlobalConfig()
    expect(config.autoResumeOnCrash).toBe('prompt')
  })
})
