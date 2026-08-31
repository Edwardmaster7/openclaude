import { describe, expect, test } from 'bun:test'
import { parseWebhookChannelArgs } from './cli.js'

describe('parseWebhookChannelArgs', () => {
  test('parses --port and --token', () => {
    const result = parseWebhookChannelArgs(['--port', '9000', '--token', 'sekret'])
    expect(result).toEqual({ port: 9000, token: 'sekret' })
  })

  test('defaults port to 8787 when omitted', () => {
    const result = parseWebhookChannelArgs(['--token', 'sekret'])
    expect(result).toEqual({ port: 8787, token: 'sekret' })
  })

  test('errors when --token is missing', () => {
    const result = parseWebhookChannelArgs([])
    expect('error' in result).toBe(true)
  })

  test('errors when --port is not a number', () => {
    const result = parseWebhookChannelArgs(['--port', 'abc', '--token', 'sekret'])
    expect('error' in result).toBe(true)
  })
})
