import { describe, expect, test } from 'bun:test'
import { handleSendMessageCall, SEND_MESSAGE_TOOL } from './server.js'

describe('SEND_MESSAGE_TOOL', () => {
  test('is named send_message and requires content', () => {
    expect(SEND_MESSAGE_TOOL.name).toBe('send_message')
    expect(SEND_MESSAGE_TOOL.inputSchema.required).toEqual(['content'])
  })
})

describe('handleSendMessageCall', () => {
  test('invokes emit with the given content and returns a non-error result', async () => {
    const emitted: Array<{ content: string; meta?: Record<string, string> }> = []
    const result = await handleSendMessageCall({ content: 'pong' }, async (content, meta) => {
      emitted.push({ content, meta })
    })
    expect(result.isError).toBeFalsy()
    expect(emitted).toEqual([{ content: 'pong', meta: undefined }])
  })

  test('returns an error result when content is missing', async () => {
    const result = await handleSendMessageCall({}, async () => {})
    expect(result.isError).toBe(true)
  })

  test('returns an error result when content is an empty string', async () => {
    const result = await handleSendMessageCall({ content: '' }, async () => {})
    expect(result.isError).toBe(true)
  })

  test('returns an error result when args is not an object', async () => {
    const result = await handleSendMessageCall(null, async () => {})
    expect(result.isError).toBe(true)
  })
})
