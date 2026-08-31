/**
 * OpenAI-compatible API shim for Claude Code.
 *
 * Translates Anthropic SDK calls (anthropic.beta.messages.create) into
 * OpenAI-compatible chat completion requests and streams back events
 * in the Anthropic streaming format so the rest of the codebase is unaware.
 *
 * Supports: OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter,
 * Together, Groq, Fireworks, DeepSeek, Mistral, and any OpenAI-compatible API.
 *
 * Environment variables:
 *   CLAUDE_CODE_USE_OPENAI=1          — enable this provider
 *   OPENAI_API_KEY=sk-...             — API key (optional for local models)
 *   OPENAI_API_KEYS=sk-a,sk-b         — optional comma-separated key pool for rotation
 *   OPENAI_AUTH_HEADER=api-key        — optional custom auth header name
 *   OPENAI_AUTH_HEADER_VALUE=...      — optional custom auth header value
 *   OPENAI_AUTH_SCHEME=bearer|raw     — auth scheme for Authorization/custom header handling
 *   OPENAI_API_FORMAT=chat_completions|responses — request format for compatible APIs
 *   OPENAI_BASE_URL=http://...        — base URL (default: https://api.openai.com/v1)
 *   OPENAI_MODEL=gpt-4o              — default model override
 *   CODEX_API_KEY / ~/.codex/auth.json — Codex auth for codexplan/codexspark
 *
 * Smart auto-routing (opt-in; startup defaults, overridden by settings.smartRouting):
 *   OPENCLAUDE_SMART_ROUTING=1|true   — route simple turns to a cheaper model
 *   OPENCLAUDE_SMART_ROUTING_SIMPLE=<key> — agentModels key or model id for simple turns
 *   OPENCLAUDE_SMART_ROUTING_STRONG=<key> — agentModels key or model id for strong turns
 *
 * GitHub Copilot API (api.githubcopilot.com), OpenAI-compatible:
 *   CLAUDE_CODE_USE_GITHUB=1         — enable GitHub inference (no need for USE_OPENAI)
 *   GITHUB_TOKEN or GH_TOKEN         — Copilot API token (mapped to Bearer auth)
 *   OPENAI_MODEL                     — optional; use github:copilot or openai/gpt-4.1 style IDs
 *
 * Azure OpenAI / Microsoft Foundry (OpenAI-compatible chat):
 *   AZURE_OPENAI_API_VERSION         — query param for chat/completions (default: 2024-12-01-preview)
 *   OPENAI_AZURE_STYLE=1             — force Azure deployment URL + api-key header when the hostname
 *                                     would not otherwise match (for example inference.ml.azure.com)
 */

import { APIError } from '@anthropic-ai/sdk'
import { logForDebugging } from '../../utils/debug.js'
import { createStreamAbortError, getStreamIdleTimeoutMs, readWithIdleTimeout, StreamIdleTimeoutError } from './openaiShim/streamControl.js'
export { getStreamIdleTimeoutMs } from './openaiShim/streamControl.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { type OpenAIShimEffortLevel } from '../../utils/effort.js'
import { COPILOT_HEADERS } from '../github/deviceFlow.js'
import { resolveGeminiCredential } from '../../utils/geminiAuth.js'
import { hydrateGeminiAccessTokenFromSecureStorage } from '../../utils/geminiCredentials.js'
import {
  hydrateGithubModelsTokenFromSecureStorage,
  refreshCopilotTokenOn401,
} from '../../utils/githubModelsCredentials.js'
import { resolveXaiAccessToken } from '../../utils/xaiCredentials.js'
import {
  getRouteDescriptor,
  isLongcatBaseUrl,
  isXaiBaseUrl,
  resolveRouteCredentialValue,
} from '../../integrations/routeMetadata.js'
import { getSessionId } from '../../bootstrap/state.js'
import {
  codexStreamToAnthropic,
  collectCodexCompletedResponse,
  convertCodexResponseToAnthropicMessage,
  type AnthropicStreamEvent,
  type ShimCreateParams,
} from './codexShim.js'
import { dispatchCodexRequest } from './openaiShim/codexDispatch.js'
import { hydrateOpenAIShimCompatibilityEnv as hydrateRequestPlanningEnv } from './openaiShim/requestPlanner.js'
import { prepareOpenAIRequest } from './openaiShim/requestPreparation.js'
import {
  anthropicSsePassthrough,
  convertGeminiToAnthropicResponse,
  convertNonStreamingResponseToAnthropicMessage,
  geminiSseToAnthropic,
  makeMessageId,
  openaiStreamToAnthropic as convertOpenAIResponseStream,
} from './openaiShim/responseAdapters.js'
export { parseTextToolCalls, parseXmlToolCalls } from './openaiShim/responseAdapters.js'
import {
  createClassifiedTransportError,
  fetchWithHeadersDeadline,
  getApiTimeoutMs,
  preserveCallerAbortError,
  redactUrlForDiagnostics,
  redactUrlsInMessage,
  ResponseHeadersTimeoutError,
} from './openaiShim/transport.js'
export { getApiTimeoutMs } from './openaiShim/transport.js'
import { executeOpenAIRequest } from './openaiShim/requestExecutor.js'
import {
  getLocalProviderRetryBaseUrls,
  isAzureStyleBaseUrl,
  isLocalProviderUrl,
  resolveProviderRequest,
  shouldAttemptLocalToollessRetry,
} from './providerConfig.js'
import {
  buildOpenAICompatibilityErrorMessage,
  classifyOpenAIHttpFailure,
  classifyOpenAINetworkFailure,
  markOpenAIRequestNonReplayable,
} from './openaiErrorClassification.js'
import { redactSecretValueForDisplay } from '../../utils/providerProfile.js'
import { logApiCallStart, logApiCallEnd } from '../../utils/requestLogging.js'
import {
  createStreamState,
  processStreamChunk,
  getStreamStats,
} from '../../utils/streamingOptimizer.js'
import { stableStringifyJson } from '../../utils/stableStringify.js'
import { getGlobalConfig } from '../../utils/config.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { roughTokenCountEstimationForMessages, roughTokenCountEstimation } from '../tokenEstimation.js'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import crypto from 'node:crypto'
import { fetchWithProxyRetry } from './fetchWithProxyRetry.js'
import {
  type NonStreamingOpenAIResponse,
} from './openaiShim/responseConversion.js'
import {
  CredentialPool,
  type CredentialLease,
  hasInvalidCredentialPlaceholder,
  parseCredentialList,
} from './credentialPool.js'
import {
  filterAnthropicHeaders,
  geminiThoughtSignatureFromExtraContent,
  hasGeminiApiHost as matchesGeminiApiHost,
  hasMistralApiHost,
  isGithubModelsMode,
  isGeminiModelName,
  mergeGeminiThoughtSignature,
  shouldPreserveGeminiThoughtSignature as shouldPreserveGeminiThoughtSignatureForRoute,
} from './openaiShim/providerCompatibility.js'

export { hasMistralApiHost }
import {
  buildOllamaChatUrl,
  convertOllamaNonStreamingResponse,
  convertOllamaStreamingResponse,
} from './openaiShim/ollamaAdapter.js'
import {
  convertMessages as convertAnthropicMessages,
  convertSystemPrompt as convertSystemPromptImpl,
} from './openaiShim/messageConversion.js'
import {
  convertTools as convertToolsModule,
  normalizeSchemaForOpenAI as normalizeSchemaForOpenAIModule,
} from './openaiShim/toolConversion.js'

const GITHUB_429_MAX_RETRIES = 3
const GITHUB_429_BASE_DELAY_SEC = 1
const GITHUB_429_MAX_DELAY_SEC = 32
const CREDENTIAL_POOL_COOLDOWN_MS = 30_000
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 90_000
const GEMINI_API_HOST = 'generativelanguage.googleapis.com'
function isCopilotTokenExpiredError(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('token expired') || lower.includes('token has expired')
}

function hasGeminiApiHost(baseUrl: string | undefined): boolean {
  return matchesGeminiApiHost(baseUrl, GEMINI_API_HOST)
}

function shouldPreserveGeminiThoughtSignature(
  model: string | undefined,
  baseUrl?: string,
): boolean {
  return shouldPreserveGeminiThoughtSignatureForRoute(
    model,
    baseUrl,
    isGeminiMode(),
    GEMINI_API_HOST,
  )
}

function formatRetryAfterHint(response: Response): string {
  const ra = response.headers.get('retry-after')
  return ra ? ` (Retry-After: ${ra})` : ''
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Types — minimal subset of Anthropic SDK types we need to produce
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Message format conversion: Anthropic → OpenAI
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | OpenAIContentPart[]
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
    extra_content?: Record<string, unknown>
  }>
  tool_call_id?: string
  name?: string
  /**
   * Per-assistant-message chain-of-thought, attached when echoing an
   * assistant message back to providers that require it (notably Moonshot:
   * "thinking is enabled but reasoning_content is missing in assistant
   * tool call message at index N" 400). Derived from the Anthropic thinking
   * block captured when the original response was translated.
   */
  reasoning_content?: string
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
    strict?: boolean
  }
}

function convertSystemPrompt(system: unknown): string {
  return convertSystemPromptImpl(system)
}

function contentBlocksContainImages(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some(block => {
    if (!block || typeof block !== 'object') return false
    const record = block as Record<string, unknown>
    if (
      record.type === 'image' ||
      record.type === 'image_url' ||
      record.type === 'input_image'
    ) return true
    return record.type === 'tool_result' && contentBlocksContainImages(record.content)
  })
}

function requestBodyContainsImages(
  payload: Record<string, unknown> | undefined,
): boolean {
  if (!payload) return false
  const messages = payload.messages
  if (Array.isArray(messages) && messages.some(message => {
    if (!message || typeof message !== 'object') return false
    const record = message as Record<string, unknown>
    return contentBlocksContainImages(record.content) ||
      (Array.isArray(record.images) && record.images.length > 0)
  })) return true
  const input = payload.input
  if (Array.isArray(input) && input.some(item =>
    item && typeof item === 'object' &&
    contentBlocksContainImages((item as Record<string, unknown>).content),
  )) return true
  const contents = payload.contents
  return Array.isArray(contents) && contents.some(item => {
    if (!item || typeof item !== 'object') return false
    const parts = (item as Record<string, unknown>).parts
    return Array.isArray(parts) && parts.some(part => {
      if (!part || typeof part !== 'object') return false
      const record = part as Record<string, unknown>
      return ['inlineData', 'fileData'].some(key => {
        const data = record[key]
        if (!data || typeof data !== 'object') return false
        const mimeType = (data as Record<string, unknown>).mimeType
        return typeof mimeType === 'string' &&
          mimeType.trim().toLowerCase().startsWith('image/')
      })
    })
  })
}

function isGeminiMode(): boolean {
  return (
    isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI) ||
    hasGeminiApiHost(process.env.OPENAI_BASE_URL)
  )
}

function hydrateOpenAIShimCompatibilityEnv(
  processEnv: NodeJS.ProcessEnv = process.env,
): void {
  hydrateRequestPlanningEnv(processEnv, {
    isEnvTruthy,
    resolveRouteCredentialValue,
  })
}

function convertMessages(
  messages: Array<{ role: string; message?: { role?: string; content?: unknown }; content?: unknown }>,
  system: unknown,
  options?: {
    preserveReasoningContent?: boolean
    reasoningContentFallback?: '' | 'omit'
    preserveGeminiThoughtSignature?: boolean
    supportsImageInputs?: boolean
    formatForGemini?: boolean
  },
): OpenAIMessage[] {
  return convertAnthropicMessages(messages, system, {
    ...options,
    getGeminiThoughtSignature: geminiThoughtSignatureFromExtraContent,
    mergeGeminiThoughtSignature,
    log: message => logForDebugging(message),
  })
}
function getChatMessagesForTransport<T>(
  transport: string,
  convert: () => T,
): T | undefined {
  return transport === 'chat_completions' ? convert() : undefined
}

function getCompressedMessagesForTransport<T>(
  transport: string,
  rawMessages: T,
  compress: () => T,
): T {
  return transport === 'chat_completions' ||
    transport === 'responses' ||
    transport === 'responses_compat'
    ? compress()
    : rawMessages
}

/**
 * OpenAI requires every key in `properties` to also appear in `required`.
 * Anthropic schemas often mark fields as optional (omitted from `required`),
 * which causes 400 errors on OpenAI/Codex endpoints. This normalizes the
 * schema by ensuring `required` is a superset of `properties` keys.
 */
function normalizeSchemaForOpenAI(
  schema: Record<string, unknown>,
  strict = true,
): Record<string, unknown> {
  return normalizeSchemaForOpenAIModule(schema, strict)
}

function convertTools(
  tools: Array<{ name: string; description?: string; input_schema?: Record<string, unknown> }>,
  options: { skipStrict?: boolean } = {},
): OpenAITool[] {
  return convertToolsModule(tools, {
    isGemini: isGeminiMode(),
    disableStrictTools: isEnvTruthy(process.env.OPENCLAUDE_DISABLE_STRICT_TOOLS),
    skipStrict: options.skipStrict,
    normalizeSchema: normalizeSchemaForOpenAI,
  })
}

// ---------------------------------------------------------------------------
// Streaming: OpenAI SSE → Anthropic stream events
// ---------------------------------------------------------------------------

import { headersWithRequestUrl as buildHeadersWithRequestUrl } from './openaiShim/clientDispatch.js'

function headersWithRequestUrl(headers: Headers, requestUrl?: string): Headers {
  return buildHeadersWithRequestUrl(headers, requestUrl)
}

// Extraction seam: response metadata | generic stream conversion.

async function* openaiStreamToAnthropic(
  response: Response,
  model: string,
  signal?: AbortSignal,
  isOllama = false,
  requestUrl?: string,
): AsyncGenerator<AnthropicStreamEvent> {
  yield* convertOpenAIResponseStream(
    response,
    model,
    signal,
    isOllama,
    requestUrl,
    headersWithRequestUrl,
  )
}


// Extraction seam: stream conversion | stream lifecycle façade.

// ---------------------------------------------------------------------------
// The shim client — duck-types as Anthropic SDK
// ---------------------------------------------------------------------------

import { createShimRequest } from './openaiShim/clientDispatch.js'

// Gemini context caching types and persistence
type GeminiContextCacheEntry = {
  cacheName: string
  expireTime: number
  model: string
}

function getGeminiDiskCachePath(): string {
  return join(getClaudeConfigHomeDir(), 'gemini-context-cache.json')
}

function loadGeminiContextCache(): Map<string, GeminiContextCacheEntry> {
  const path = getGeminiDiskCachePath()
  if (!existsSync(path)) return new Map()
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    const map = new Map<string, GeminiContextCacheEntry>()
    const now = Date.now()
    for (const [key, value] of Object.entries(data)) {
      const entry = value as GeminiContextCacheEntry
      if (entry && entry.expireTime > now) {
        map.set(key, entry)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

function saveGeminiContextCache(map: Map<string, GeminiContextCacheEntry>) {
  const path = getGeminiDiskCachePath()
  try {
    const obj: Record<string, GeminiContextCacheEntry> = {}
    const now = Date.now()
    for (const [key, value] of map.entries()) {
      if (value.expireTime > now) {
        obj[key] = value
      }
    }
    writeFileSync(path, JSON.stringify(obj, null, 2), 'utf8')
  } catch {
    // Ignore cache persistence write errors
  }
}

let geminiContextCacheMap: Map<string, GeminiContextCacheEntry> | undefined

function getGeminiContextCache(): Map<string, GeminiContextCacheEntry> {
  if (!geminiContextCacheMap) {
    geminiContextCacheMap = loadGeminiContextCache()
  }
  return geminiContextCacheMap
}

class OpenAIShimMessages {
  private defaultHeaders: Record<string, string>
  private reasoningEffort?: OpenAIShimEffortLevel
  private providerOverride?: { model: string; baseURL: string; apiKey: string }
  private credentialPool?: CredentialPool
  private credentialPoolRaw?: string
  private lastCacheName?: string
  private lastPrefixHash?: string

  constructor(defaultHeaders: Record<string, string>, reasoningEffort?: OpenAIShimEffortLevel, providerOverride?: { model: string; baseURL: string; apiKey: string }) {
    this.defaultHeaders = filterAnthropicHeaders(defaultHeaders)
    this.reasoningEffort = reasoningEffort
    this.providerOverride = providerOverride
  }

  private getCredentialPool(raw: string): CredentialPool | null {
    const credentials = parseCredentialList(raw)
    if (credentials.length === 0) {
      this.credentialPool = undefined
      this.credentialPoolRaw = undefined
      return null
    }

    if (!this.credentialPool || this.credentialPoolRaw !== raw) {
      this.credentialPool = new CredentialPool(credentials)
      this.credentialPoolRaw = raw
    }

    return this.credentialPool
  }

  create(
    params: ShimCreateParams,
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
  ) {
    const requestProcessEnv = this.providerOverride
      ? { ...process.env, OPENAI_AZURE_STYLE: undefined }
      : process.env
    return createShimRequest(params, options, {
      providerOverride: this.providerOverride,
      reasoningEffort: this.reasoningEffort,
      processEnv: requestProcessEnv,
      doRequest: this._doRequest.bind(this),
      convertNonStreamingResponse: this._convertNonStreamingResponse.bind(this),
      convertGeminiResponse: this._convertGeminiToAnthropicResponse.bind(this),
      codexStreamToAnthropic,
      collectCodexCompletedResponse,
      convertCodexResponseToAnthropicMessage,
      createStreamAbortError,
      anthropicSsePassthrough,
      geminiSseToAnthropic,
      openaiStreamToAnthropic,
      isGithubModelsMode,
      makeMessageId,
    })
  }
  private async _doRequest(
    request: ReturnType<typeof resolveProviderRequest>,
    params: ShimCreateParams,
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
    requestProcessEnv: NodeJS.ProcessEnv = process.env,
  ): Promise<Response> {
    const codexResponse = await dispatchCodexRequest({
      request,
      params,
      requestOptions: options,
      defaultHeaders: this.defaultHeaders,
      providerOverrideApiKey: this.providerOverride?.apiKey,
      dependencies: {
        getApiTimeoutMs,
        fetchWithHeadersDeadline,
        preserveCallerAbortError,
        isCopilotTokenExpiredError,
        classifyResponseHeadersTimeout: (error, requestUrl, model) => {
          if (!(error instanceof ResponseHeadersTimeoutError)) return undefined
          const failure = {
            ...classifyOpenAINetworkFailure(error, { url: requestUrl }),
            retryable: false,
          }
          return createClassifiedTransportError(error, requestUrl, model, failure)
        },
      },
    })
    if (codexResponse) return codexResponse

    try {
      return await this._doOpenAIRequest(request, params, options, requestProcessEnv)
    } catch (err) {
      if (this.lastCacheName && err instanceof Error && 'status' in err && (err.status === 404 || err.status === 400) && err.message.toLowerCase().includes('cache')) {
        logForDebugging(`[GeminiContextCaching] Cache error detected (${err.message}). Retrying without cache...`)
        if (this.lastPrefixHash) {
          getGeminiContextCache().delete(this.lastPrefixHash)
          saveGeminiContextCache(getGeminiContextCache())
        }
        return this._doOpenAIRequest(request, params, { ...options, skipGeminiCache: true }, requestProcessEnv)
      }
      throw err
    }
  }

  private async _doOpenAIRequest(
    request: ReturnType<typeof resolveProviderRequest>,
    rawParams: ShimCreateParams,
    options?: { signal?: AbortSignal; headers?: Record<string, string>; skipGeminiCache?: boolean },
    requestProcessEnv: NodeJS.ProcessEnv = process.env,
  ): Promise<Response> {
    let params = rawParams
    let cacheName: string | undefined
    let prefixHash = ''
    const apiTimeoutMs = getApiTimeoutMs()

    // Gemini context caching. Computed before prepareOpenAIRequest so a cache
    // hit can strip the cached prefix (system/tools/earlier messages) from
    // the outgoing payload instead of resending it every turn. Operates on
    // raw (uncompressed) messages — compression only applies inside
    // prepareOpenAIRequest for chat_completions-style transports and never
    // for the native Gemini transport, so hashing/caching pre-compression
    // keeps the cached prefix consistent across both access paths.
    const isGeminiRequest = isGeminiMode() ||
      request.baseUrl.includes('generativelanguage.googleapis.com') ||
      request.resolvedModel.toLowerCase().includes('gemini')
    const globalConfig = getGlobalConfig()
    const rawMessages = params.messages as Array<{
      role: string
      message?: { role?: string; content?: unknown }
      content?: unknown
    }>
    let prefixMessages: typeof rawMessages = []

    if (globalConfig.geminiContextCachingEnabled && isGeminiRequest && !options?.skipGeminiCache) {
      try {
        prefixMessages = rawMessages.slice(0, -1)

        const systemText = convertSystemPrompt(params.system) || ''
        const systemTokens = roughTokenCountEstimation(systemText)
        const toolsTokens = params.tools ? roughTokenCountEstimation(JSON.stringify(params.tools)) : 0
        const prefixMessagesTokens = prefixMessages.length > 0
          ? roughTokenCountEstimationForMessages(prefixMessages.map(m => ({
              type: m.role,
              message: { content: m.content },
            })))
          : 0

        const totalPrefixTokens = systemTokens + toolsTokens + prefixMessagesTokens

        const modelLower = request.resolvedModel.toLowerCase()
        const isGemini3 = modelLower.includes('gemini-3')
        const autoThreshold = isGemini3 ? 4096 : 2048
        const minThreshold = globalConfig.geminiContextCachingThreshold || autoThreshold

        if (totalPrefixTokens >= minThreshold) {
          prefixHash = crypto.createHash('sha256')
            .update(systemText)
            .update(stableStringifyJson(params.tools || []))
            .update(stableStringifyJson(prefixMessages || []))
            .update(request.resolvedModel)
            .digest('hex')

          const now = Date.now()
          const cachedEntry = getGeminiContextCache().get(prefixHash)

          if (cachedEntry && cachedEntry.expireTime > now && cachedEntry.model === request.resolvedModel) {
            cacheName = cachedEntry.cacheName
            logForDebugging(`[GeminiContextCaching] Cache hit: ${cacheName}`)
          } else {
            if (cachedEntry) {
              getGeminiContextCache().delete(prefixHash)
            }

            let modelName = request.resolvedModel
            if (!modelName.startsWith('models/') && !modelName.startsWith('publishers/')) {
              modelName = `models/${modelName}`
            }

            const cachedContentsList: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []
            const toolUseIdToName = new Map<string, string>()
            for (const msg of rawMessages) {
              if (!Array.isArray(msg.content)) continue
              for (const block of msg.content as Array<{ type?: string; id?: string; name?: string }>) {
                if (block.type === 'tool_use' && block.id && block.name) {
                  toolUseIdToName.set(block.id, block.name)
                }
              }
            }

            for (const msg of prefixMessages) {
              const role = msg.role === 'assistant' ? 'model' : 'user'
              const parts: Array<Record<string, unknown>> = []

              if (typeof msg.content === 'string') {
                parts.push({ text: msg.content })
              } else if (Array.isArray(msg.content)) {
                for (const block of msg.content as Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown; is_error?: boolean }>) {
                  if (block.type === 'text' && block.text) {
                    parts.push({ text: block.text })
                  } else if (block.type === 'tool_use' && block.id && block.name) {
                    parts.push({
                      functionCall: {
                        name: block.name,
                        args: block.input ?? {},
                      },
                    })
                  } else if (block.type === 'tool_result' && block.tool_use_id) {
                    const funcName = toolUseIdToName.get(block.tool_use_id) ?? block.tool_use_id
                    let resultContent = typeof block.content === 'string'
                      ? block.content
                      : Array.isArray(block.content)
                        ? (block.content as Array<{ type?: string; text?: string }>)
                          .filter(b => b.type === 'text')
                          .map(b => b.text ?? '')
                          .join('\n')
                        : ''
                    if (block.is_error) {
                      resultContent = `Error: ${resultContent}`
                    }
                    parts.push({
                      functionResponse: {
                        name: funcName,
                        response: {
                          name: funcName,
                          content: resultContent,
                        },
                      },
                    })
                  }
                }
              }
              if (parts.length > 0) {
                cachedContentsList.push({ role, parts })
              }
            }

            const cacheBody: Record<string, unknown> = {
              model: modelName,
            }
            if (cachedContentsList.length > 0) {
              cacheBody.contents = cachedContentsList
            }
            if (systemText) {
              cacheBody.systemInstruction = { parts: [{ text: systemText }] }
            }
            if (params.tools && params.tools.length > 0) {
              const functionDeclarations = (params.tools as Array<{
                name?: string
                description?: string
                input_schema?: Record<string, unknown>
              }>).map(tool => ({
                name: tool.name ?? '',
                description: tool.description ?? '',
                ...(tool.input_schema ? { parameters: tool.input_schema } : {}),
              }))
              if (functionDeclarations.length > 0) {
                cacheBody.tools = [{ functionDeclarations }]
              }
            }

            const ttlSeconds = globalConfig.geminiContextCachingTtl ?? 900
            cacheBody.ttl = `${ttlSeconds}s`

            let cacheUrl = request.baseUrl
            if (cacheUrl.endsWith('/openai')) {
              cacheUrl = cacheUrl.slice(0, -7)
            }
            cacheUrl = `${cacheUrl}/cachedContents`

            const cacheHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
            }
            const geminiCredential = await resolveGeminiCredential(requestProcessEnv)
            if (geminiCredential.kind === 'api-key') {
              cacheHeaders['x-goog-api-key'] = geminiCredential.credential
            } else if (geminiCredential.kind !== 'none') {
              cacheHeaders['Authorization'] = `Bearer ${geminiCredential.credential}`
              if ('projectId' in geminiCredential && geminiCredential.projectId) {
                cacheHeaders['x-goog-user-project'] = geminiCredential.projectId
              }
            }

            logForDebugging(`[GeminiContextCaching] Creating context cache...`)
            const createRes = await fetchWithProxyRetry(cacheUrl, {
              method: 'POST',
              headers: cacheHeaders,
              body: JSON.stringify(cacheBody),
            })

            if (createRes.ok) {
              const createData = await createRes.json() as { name: string; expireTime: string }
              cacheName = createData.name
              const expireTime = Date.parse(createData.expireTime) || (Date.now() + ttlSeconds * 1000)

              getGeminiContextCache().set(prefixHash, {
                cacheName,
                expireTime,
                model: request.resolvedModel,
              })
              saveGeminiContextCache(getGeminiContextCache())
              logForDebugging(`[GeminiContextCaching] Cache successfully created: ${cacheName}`)
            } else {
              const errText = await createRes.text()
              logForDebugging(`[GeminiContextCaching] Failed to create cache: status=${createRes.status} body=${errText}`, { level: 'warn' })
            }
          }
        }
      } catch (err) {
        logForDebugging(`[GeminiContextCaching] Error during cache process: ${err}`, { level: 'warn' })
      }
    }

    this.lastCacheName = cacheName
    this.lastPrefixHash = prefixHash

    if (cacheName) {
      params = {
        ...params,
        system: undefined,
        tools: undefined,
        messages: rawMessages.slice(prefixMessages.length),
      }
    }

    const prepared = prepareOpenAIRequest({
      request,
      params,
      requestProcessEnv,
      providerOverride: this.providerOverride,
      dependencies: {
        convertMessages,
        convertSystemPrompt,
        convertTools,
        hasGeminiApiHost,
        isGeminiMode,
        shouldPreserveGeminiThoughtSignature,
      },
    })
    const {
      fastPath,
      runtimeShimContext,
      shimConfig,
      body,
      effectiveTransport,
      useNativeOllamaChat,
      buildResponsesBody,
      serializeBody,
      isLocal,
      isGithub,
      isGithubCopilot,
      isGithubModels,
      omitTools,
    } = prepared

    // Gemini context caching: inject the cache reference into whichever body
    // shape serializeBody() produces (chat_completions vs native Gemini)
    // without threading cacheName through the request-planning modules.
    const serializeBodyWithGeminiCache = cacheName
      ? () => {
          const payload = JSON.parse(serializeBody()) as Record<string, unknown>
          if (effectiveTransport === 'gemini') {
            payload.cachedContent = cacheName
          } else {
            payload.cached_content = cacheName
          }
          return JSON.stringify(payload)
        }
      : serializeBody

    // Extraction boundary: request planning | request execution.
    // The prepared body builders above are executor inputs, not executor-owned logic.
    // Keep this marker stable so either extraction can merge independently.
    return executeOpenAIRequest({
      defaultHeaders: this.defaultHeaders,
      providerOverride: this.providerOverride,
      routeAcceptsGenericOpenAICredentials:
        runtimeShimContext.routeId === null ||
        getRouteDescriptor(runtimeShimContext.routeId)?.setup
          .dedicatedCredentialsOnly !== true,
      getCredentialPool: value => this.getCredentialPool(value),
      filterAnthropicHeaders, isGeminiMode, resolveRouteCredentialValue, isXaiBaseUrl, isLongcatBaseUrl, parseCredentialList, resolveXaiAccessToken, hasInvalidCredentialPlaceholder, buildOpenAICompatibilityErrorMessage, isAzureStyleBaseUrl, resolveGeminiCredential, COPILOT_HEADERS, getSessionId, getLocalProviderRetryBaseUrls, buildOllamaChatUrl, logForDebugging, redactUrlForDiagnostics, redactSecretValueForDisplay, headersWithRequestUrl, classifyOpenAINetworkFailure, classifyOpenAIHttpFailure, markOpenAIRequestNonReplayable, fetchRequest: (url, init) => fetchWithHeadersDeadline(url, init, { callerSignal: options?.signal, timeoutMs: apiTimeoutMs }), isResponseHeadersTimeout: error => error instanceof ResponseHeadersTimeoutError, requestBodyContainsImages, formatRetryAfterHint, redactUrlsInMessage, sleepMs, shouldAttemptLocalToollessRetry, refreshCopilotTokenOn401, isCopilotTokenExpiredError, convertOllamaStreamingResponse, convertOllamaNonStreamingResponse, logApiCallStart, logApiCallEnd, stableStringifyJson, APIError, GITHUB_429_MAX_RETRIES, GITHUB_429_BASE_DELAY_SEC, GITHUB_429_MAX_DELAY_SEC, request, params, options, requestProcessEnv, fastPath, shimConfig, runtimeShimContext, body, effectiveTransport, useNativeOllamaChat, buildResponsesBody, serializeBody: serializeBodyWithGeminiCache, isLocal, isGithub, isGithubCopilot, isGithubModels, omitTools,
    })
  }

  private _convertNonStreamingResponse(
    data: NonStreamingOpenAIResponse,
    model: string,
  ) {
    return convertNonStreamingResponseToAnthropicMessage(data, model)
  }

  private _convertGeminiToAnthropicResponse(
    data: Record<string, unknown>,
    model: string,
  ) {
    return convertGeminiToAnthropicResponse(data, model)
  }
}

class OpenAIShimBeta {
  messages: OpenAIShimMessages
  reasoningEffort?: OpenAIShimEffortLevel

  constructor(defaultHeaders: Record<string, string>, reasoningEffort?: OpenAIShimEffortLevel, providerOverride?: { model: string; baseURL: string; apiKey: string }) {
    this.messages = new OpenAIShimMessages(defaultHeaders, reasoningEffort, providerOverride)
    this.reasoningEffort = reasoningEffort
  }
}

export function createOpenAIShimClient(options: {
  defaultHeaders?: Record<string, string>
  maxRetries?: number
  timeout?: number
  reasoningEffort?: OpenAIShimEffortLevel
  providerOverride?: { model: string; baseURL: string; apiKey: string }
}): unknown {
  hydrateGeminiAccessTokenFromSecureStorage()
  hydrateGithubModelsTokenFromSecureStorage()
  hydrateOpenAIShimCompatibilityEnv()

  const beta = new OpenAIShimBeta({
    ...(options.defaultHeaders ?? {}),
  }, options.reasoningEffort, options.providerOverride)

  return {
    beta,
    messages: beta.messages,
  }
}

// Test-only surface (same pattern as WebSearchTool's __test export).
export const __test = {
  convertMessages,
  getApiTimeoutMs,
  getChatMessagesForTransport,
  getCompressedMessagesForTransport,
  requestBodyContainsImages,
  getStreamIdleTimeoutMs,
  readWithIdleTimeout,
  StreamIdleTimeoutError,
}
