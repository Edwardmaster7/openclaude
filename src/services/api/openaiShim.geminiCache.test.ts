import { afterEach, beforeEach, expect, mock, test, describe } from 'bun:test'
import { asMockFetch } from '../../test/typedMocks.js'
import { createOpenAIShimClient } from './openaiShim.js'
import { _setGlobalConfigCacheForTesting, DEFAULT_GLOBAL_CONFIG } from '../../utils/config.js'
import { setClaudeConfigHomeDirForTesting } from '../../utils/envUtils.js'
import { join } from 'node:path'
import { mkdirSync, rmSync, existsSync } from 'node:fs'

describe('Gemini Context Caching', () => {
  let originalFetch: typeof globalThis.fetch
  let tempDir: string
  let originalEnvUseGemini: string | undefined

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEnvUseGemini = process.env.CLAUDE_CODE_USE_GEMINI
    process.env.CLAUDE_CODE_USE_GEMINI = '1'
    
    // Create a temp config directory inside the workspace (fully allowed by sandbox)
    tempDir = join(process.cwd(), 'tmp-gemini-cache-dir')
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir)
    setClaudeConfigHomeDirForTesting(tempDir)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.CLAUDE_CODE_USE_GEMINI = originalEnvUseGemini
    _setGlobalConfigCacheForTesting(null)
    setClaudeConfigHomeDirForTesting(undefined)
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  test('calls cachedContents and appends cached_content when enabled', async () => {
    // Set config
    _setGlobalConfigCacheForTesting({
      ...DEFAULT_GLOBAL_CONFIG,
      geminiContextCachingEnabled: true,
      geminiContextCachingTtl: 300,
      geminiContextCachingThreshold: 1, // very low threshold to trigger caching in test
    })

    const fetchCalls: Array<{ url: string; body: any }> = []

    globalThis.fetch = asMockFetch(mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : null
      fetchCalls.push({ url, body })

      if (url.includes('/cachedContents')) {
        return new Response(
          JSON.stringify({
            name: 'cachedContents/test-caching-id-123',
            expireTime: new Date(Date.now() + 300 * 1000).toISOString(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }

      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'gemini-2.0-flash',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello, cached world!',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 10,
            total_tokens: 15,
            prompt_tokens_details: {
              cached_tokens: 200,
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }))

    const client: any = createOpenAIShimClient({
      defaultHeaders: {},
    }) as any

    const response = await client.messages.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'user', content: 'Message 1 to cache' },
        { role: 'assistant', content: 'Understood' },
        { role: 'user', content: 'Message 2 to query' },
      ],
      max_tokens: 100,
    })

    expect(response.content).toEqual([{ type: 'text', text: 'Hello, cached world!' }])

    // Verify cache creation was called
    const cacheCall = fetchCalls.find(c => c.url.includes('/cachedContents'))
    expect(cacheCall).toBeDefined()
    expect(cacheCall?.body.model).toBe('models/gemini-2.0-flash')
    expect(cacheCall?.body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Message 1 to cache' }] },
      { role: 'model', parts: [{ text: 'Understood' }] }
    ])

    // Verify completion call had cached_content
    const completionCall = fetchCalls.find(c => c.url.includes('/chat/completions'))
    expect(completionCall).toBeDefined()
    expect(completionCall?.body.cached_content).toBe('cachedContents/test-caching-id-123')
    expect(completionCall?.body.messages).toEqual([
      { role: 'user', content: 'Message 2 to query' }
    ])
  })
})
