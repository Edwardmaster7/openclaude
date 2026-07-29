/**
 * Client for the Gitlawb Ads service (ads.gitlawb.com).
 *
 * openclaude shows opt-in "sponsored tips" during inference waits; a viewer who
 * dwells on one earns opengateway credits. This module is the thin HTTP client:
 * fetch the next tip, then confirm it after the dwell so the viewer is credited.
 * The viewer is identified by an earn code (issued in the opengateway Earn tab,
 * stored in openclaude config), sent as the `x-earn-code` header.
 *
 * Earning is bounded and server-authoritative — the gateway/ads service signs
 * the impression token and measures dwell itself; this client just relays it.
 */
import { fetchWithProxyRetry } from './api/fetchWithProxyRetry.js'
import { getFsImplementation } from '../utils/fsOperations.js'
import { join } from 'path'

const DEFAULT_ADS_BASE_URL = 'https://ads.gitlawb.com'

export function adsBaseUrl(): string {
  return (process.env.ADS_BASE_URL ?? DEFAULT_ADS_BASE_URL).replace(/\/$/, '')
}

export type SponsoredTip = {
  impressionId: string
  token: string
  text: string
  name: string
  link: string
  label: string
  dwellMs: number
}

export type ConfirmResult = {
  status: string
  earnedMicro: number
  balanceMicro?: number
}

export type SessionContext = {
  turnCount?: number
  sessionDurationSec?: number
  seenImpressionIds?: string[]
}

const COMMON_HEADERS = (earnCode: string): Record<string, string> => ({
  'content-type': 'application/json',
  'user-agent': 'gitlawb-openclaude-ads',
  'x-earn-code': earnCode,
})

// Hard deadline on each ads request. fetchNextTip runs in the spinner-tip path,
// so a stalled connection must never hang it — "ads never block" is the rule.
const ADS_REQUEST_TIMEOUT_MS = 5_000

/**
 * An AbortSignal that fires after `ms`. fetchWithProxyRetry spreads `init` into
 * fetch (so the signal is honored) and treats AbortError as non-retryable. The
 * timer is unref'd so it never keeps a short-lived CLI process alive.
 *
 * Note: this is a per-CALL deadline, not per-attempt — the one signal covers all
 * of fetchWithProxyRetry's retries, so a slow first attempt leaves the retry
 * less time. That's intentional: the whole request is bounded so ads can never
 * block the spinner path.
 */
function withAbortTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  ;(timer as { unref?: () => void }).unref?.()
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}

// Cap on how much of the prompt we ever share, and best-effort redaction of the
// obvious secret/PII shapes. Heuristic — bias toward over-redaction. The ads
// service re-bounds size server-side too.
const MAX_CONTEXT_CHARS = 500

export function sanitizeForAds(text: string): string {
  return text
    .replace(/\b(sk|pk|rk|ghp|gho|ghs|xox[baprs]|AKIA|ASIA)[-_A-Za-z0-9]{8,}\b/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9._-]{10,}/g, '[redacted-jwt]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[redacted]')
    // base64-ish blobs: \b is unreliable around + and / (both \W), so bound the
    // run with explicit look-around on the base64 alphabet instead.
    .replace(/(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT_CHARS)
}

export function detectProjectTechnologies(): string[] {
  const techs: string[] = []
  try {
    const fs = getFsImplementation()
    const cwd = fs.cwd()

    if (fs.existsSync(join(cwd, 'package.json'))) {
      techs.push('nodejs')
      try {
        const pkgContent = fs.readFileSync(join(cwd, 'package.json'), { encoding: 'utf8' })
        const pkg = JSON.parse(pkgContent)
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

        if (deps.typescript) techs.push('typescript')
        if (deps.react) techs.push('react')
        if (deps.vue) techs.push('vue')
        if (deps['@angular/core']) techs.push('angular')
        if (deps.next) techs.push('nextjs')
        if (deps.nuxt) techs.push('nuxtjs')
        if (deps.svelte || deps['@sveltejs/kit']) techs.push('svelte')
        if (deps.vite) techs.push('vite')
        if (deps.tailwindcss) techs.push('tailwindcss')
        if (deps.express) techs.push('express')
        if (deps.nest) techs.push('nestjs')
      } catch {
        // Silently swallow JSON parse or read errors
      }
    }
    if (fs.existsSync(join(cwd, 'tsconfig.json'))) {
      if (!techs.includes('typescript')) techs.push('typescript')
    }
    if (fs.existsSync(join(cwd, 'go.mod'))) {
      techs.push('go')
    }
    if (fs.existsSync(join(cwd, 'Cargo.toml'))) {
      techs.push('rust')
    }
    if (
      fs.existsSync(join(cwd, 'requirements.txt')) ||
      fs.existsSync(join(cwd, 'pyproject.toml')) ||
      fs.existsSync(join(cwd, 'Pipfile')) ||
      fs.existsSync(join(cwd, 'poetry.lock'))
    ) {
      techs.push('python')
    }
    if (fs.existsSync(join(cwd, 'Gemfile'))) {
      techs.push('ruby')
    }
    if (fs.existsSync(join(cwd, 'pom.xml')) || fs.existsSync(join(cwd, 'build.gradle'))) {
      techs.push('java')
    }
    if (fs.existsSync(join(cwd, 'composer.json'))) {
      techs.push('php')
    }
    if (fs.existsSync(join(cwd, 'bun.lockb')) || fs.existsSync(join(cwd, 'bun.lock'))) {
      techs.push('bun')
    }
    if (fs.existsSync(join(cwd, 'deno.json')) || fs.existsSync(join(cwd, 'deno.jsonc'))) {
      techs.push('deno')
    }
    if (fs.existsSync(join(cwd, 'Makefile'))) {
      techs.push('makefile')
    }
    if (fs.existsSync(join(cwd, 'CMakeLists.txt'))) {
      techs.push('cmake')
    }
    if (fs.existsSync(join(cwd, 'Dockerfile')) || fs.existsSync(join(cwd, 'docker-compose.yml'))) {
      techs.push('docker')
    }
  } catch {
    // Silently handle environment/permission errors
  }
  return Array.from(new Set(techs))
}

/**
 * Fetch the next sponsored tip for this viewer. When the viewer has enabled
 * sponsored tips (which discloses prompt sharing), the sanitized latest prompt
 * is POSTed for contextual ad matching; otherwise we GET (identity-only).
 * Returns null on empty inventory / no contextual match / any error — ads must
 * never break or block the host CLI, so failures degrade silently to "no tip".
 */
export async function fetchNextTip(
  earnCode: string,
  surface = 'openclaude',
  userMessage?: string,
  sessionContext?: SessionContext,
): Promise<SponsoredTip | null> {
  const { signal, cancel } = withAbortTimeout(ADS_REQUEST_TIMEOUT_MS)
  try {
    const url = `${adsBaseUrl()}/api/ads/next?surface=${encodeURIComponent(surface)}`
    const sanitized = userMessage ? sanitizeForAds(userMessage) : ''
    const technologies = detectProjectTechnologies()
    const hasSessionFields = Boolean(
      sessionContext &&
        (sessionContext.turnCount !== undefined ||
          sessionContext.sessionDurationSec !== undefined ||
          (sessionContext.seenImpressionIds && sessionContext.seenImpressionIds.length > 0)),
    )
    const isPost = Boolean(sanitized || technologies.length > 0 || hasSessionFields)
    const init: RequestInit = isPost
      ? {
          method: 'POST',
          headers: COMMON_HEADERS(earnCode),
          body: JSON.stringify({
            context: {
              ...(sanitized ? { messages: [{ role: 'user', content: sanitized }] } : {}),
              ...(technologies.length > 0 ? { technologies } : {}),
            },
            ...(sessionContext?.turnCount !== undefined ? { turn_count: sessionContext.turnCount } : {}),
            ...(sessionContext?.sessionDurationSec !== undefined ? { session_duration_sec: sessionContext.sessionDurationSec } : {}),
            ...(sessionContext?.seenImpressionIds && sessionContext.seenImpressionIds.length > 0
              ? { seen_impression_ids: sessionContext.seenImpressionIds }
              : {}),
          }),
          signal,
        }
      : { method: 'GET', headers: COMMON_HEADERS(earnCode), signal }
    const resp = await fetchWithProxyRetry(url, init, { maxAttempts: 2 })
    if (!resp.ok) return null
    const data = (await resp.json()) as Record<string, unknown>
    // A real tip is identified by a string `token` (the signed impression). The
    // empty-slot response is `{ ad: null }` and a malformed one has no token —
    // both lack a string token, so this single check covers them. We deliberately
    // don't gate on an `ad` field: a served tip carries no `ad` key at all, so a
    // `data.ad == null` test would (wrongly) suppress every valid tip.
    if (!data || typeof data.token !== 'string') return null
    // Clamp dwell to a finite, non-negative integer — a malformed dwell_ms must
    // not yield NaN/Infinity and break the confirm-delay math downstream.
    const rawDwell = Number(data.dwell_ms ?? 5000)
    const dwellMs =
      Number.isFinite(rawDwell) && rawDwell >= 0 ? Math.trunc(rawDwell) : 5000
    return {
      impressionId: String(data.impression_id),
      token: String(data.token),
      text: String(data.tip_text ?? ''),
      name: String(data.name ?? ''),
      link: String(data.link ?? ''),
      label: String(data.label ?? 'Sponsored'),
      dwellMs,
    }
  } catch {
    return null
  } finally {
    cancel()
  }
}

/** Coerce an API number to a finite integer, or undefined when malformed. */
function toFiniteInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
}

/**
 * Confirm a shown tip after its dwell elapsed, crediting the viewer. Returns the
 * settle status + amount earned. Throws only on transport failure; callers in
 * the render path should swallow that (earning is best-effort).
 */
export async function confirmTip(
  earnCode: string,
  token: string,
): Promise<ConfirmResult> {
  const { signal, cancel } = withAbortTimeout(ADS_REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetchWithProxyRetry(
      `${adsBaseUrl()}/api/ads/confirm`,
      {
        method: 'POST',
        headers: COMMON_HEADERS(earnCode),
        body: JSON.stringify({ token }),
        signal,
      },
      { maxAttempts: 2 },
    )
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    return {
      status: String(data.status ?? (resp.ok ? 'unknown' : 'error')),
      earnedMicro: toFiniteInt(data.earned_micro) ?? 0,
      balanceMicro: toFiniteInt(data.balance_micro),
    }
  } finally {
    cancel()
  }
}

export async function validateEarnCode(
  earnCode: string,
): Promise<{ valid: boolean; error?: string }> {
  const { signal, cancel } = withAbortTimeout(ADS_REQUEST_TIMEOUT_MS)
  try {
    const url = `${adsBaseUrl()}/api/ads/next?surface=openclaude`
    const resp = await fetchWithProxyRetry(
      url,
      {
        method: 'GET',
        headers: COMMON_HEADERS(earnCode),
        signal,
      },
      { maxAttempts: 1 },
    )
    if (resp.status === 401) {
      return {
        valid: false,
        error: 'Invalid earn code. Please check it on gitlawb.com/opengateway.',
      }
    }
    if (!resp.ok) {
      return { valid: false, error: `Connection failed (HTTP ${resp.status}).` }
    }
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: 'Network error or timeout. Please check your internet connection.',
    }
  } finally {
    cancel()
  }
}
