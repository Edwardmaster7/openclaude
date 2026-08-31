import { describe, expect, test } from 'bun:test'
import {
  createHttpListener,
  isAuthorized,
  parseMessageBody,
} from './httpListener.js'

describe('isAuthorized', () => {
  test('accepts a matching Bearer token', () => {
    expect(isAuthorized('Bearer secret123', 'secret123')).toBe(true)
  })

  test('rejects a mismatched token', () => {
    expect(isAuthorized('Bearer wrong', 'secret123')).toBe(false)
  })

  test('rejects a missing header', () => {
    expect(isAuthorized(undefined, 'secret123')).toBe(false)
  })

  test('rejects a header without the Bearer prefix', () => {
    expect(isAuthorized('secret123', 'secret123')).toBe(false)
  })
})

describe('parseMessageBody', () => {
  test('parses a minimal valid body', () => {
    const result = parseMessageBody('{"content":"hello"}')
    expect(result).toEqual({ ok: true, value: { content: 'hello' } })
  })

  test('parses a body with meta', () => {
    const result = parseMessageBody(
      '{"content":"hello","meta":{"chat_id":"42"}}',
    )
    expect(result).toEqual({
      ok: true,
      value: { content: 'hello', meta: { chat_id: '42' } },
    })
  })

  test('rejects invalid JSON', () => {
    const result = parseMessageBody('not json')
    expect(result.ok).toBe(false)
  })

  test('rejects a missing content field', () => {
    const result = parseMessageBody('{"meta":{"chat_id":"42"}}')
    expect(result.ok).toBe(false)
  })

  test('rejects an empty content string', () => {
    const result = parseMessageBody('{"content":""}')
    expect(result.ok).toBe(false)
  })

  test('rejects a non-string meta value', () => {
    const result = parseMessageBody('{"content":"hi","meta":{"n":1}}')
    expect(result.ok).toBe(false)
  })
})

describe('createHttpListener', () => {
  test('returns 401 without a valid token', async () => {
    const server = createHttpListener({
      port: 0,
      token: 'secret123',
      onMessage: () => {},
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a bound AddressInfo')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/message`, {
      method: 'POST',
      body: JSON.stringify({ content: 'hi' }),
    })
    expect(res.status).toBe(401)
    server.close()
  })

  test('returns 202 and invokes onMessage with a valid token and body', async () => {
    const received: unknown[] = []
    const server = createHttpListener({
      port: 0,
      token: 'secret123',
      onMessage: msg => received.push(msg),
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a bound AddressInfo')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/message`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret123' },
      body: JSON.stringify({ content: 'hi there' }),
    })
    expect(res.status).toBe(202)
    expect(received).toEqual([{ content: 'hi there' }])
    server.close()
  })

  test('returns 400 for a malformed body even with a valid token', async () => {
    const server = createHttpListener({
      port: 0,
      token: 'secret123',
      onMessage: () => {},
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a bound AddressInfo')
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/message`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret123' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
    server.close()
  })
})
