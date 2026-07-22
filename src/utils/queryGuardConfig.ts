const ENV_PREFIX = 'OPENCLAUDE_QUERY_'
export const OPENCLAUDE_QUERY_HARD_MAX_MS_ENV =
  `${ENV_PREFIX}HARD_MAX_MS`
export const OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV =
  `${ENV_PREFIX}IDLE_TIMEOUT_MS`
export const OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV =
  `${ENV_PREFIX}TOOL_LEASE_GRACE_MS`

// setTimeout-compatible upper bound; larger values can overflow timer APIs.
export const MAX_CONFIGURABLE_QUERY_HARD_MAX_MS = 0x7fffffff
export const MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS = 0x7fffffff
export const MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS = 0x7fffffff

type EnvLike = Record<string, string | undefined>
type DebugLogger = (
  message: string,
  options?: { level: 'warn' },
) => void

export type QueryGuardResolvedOptions = {
  hardMaxQueryMs?: number
  idleTimeoutMs?: number
  toolLeaseGraceMs?: number
}

function warnInvalid(
  envVar: string,
  value: string,
  reason: string,
  log: DebugLogger,
): void {
  log(
    `${envVar} invalid value "${value}" (${reason}); using default`,
    { level: 'warn' },
  )
}

function defaultWarnLogger(message: string): void {
  console.warn(`[OpenClaude] ${message}`)
}

function resolvePositiveIntEnv(
  envVar: string,
  raw: string | undefined,
  maxConfigurable: number,
  acceptZero: boolean,
  log: DebugLogger,
): number | undefined {
  const value = raw?.trim()
  if (!value) return undefined

  if (!/^\d+$/.test(value)) {
    warnInvalid(envVar, value, 'expected a non-negative integer in milliseconds', log)
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || (!acceptZero && parsed === 0)) {
    warnInvalid(envVar, value, 'expected a non-negative finite integer', log)
    return undefined
  }

  if (parsed > maxConfigurable) {
    warnInvalid(
      envVar,
      value,
      `maximum is ${maxConfigurable}`,
      log,
    )
    return undefined
  }

  return parsed
}

export function getQueryGuardOptionsFromEnv(
  env: EnvLike = process.env,
  log: DebugLogger = defaultWarnLogger,
): QueryGuardResolvedOptions {
  const hardMaxMs = resolvePositiveIntEnv(
    OPENCLAUDE_QUERY_HARD_MAX_MS_ENV,
    env[OPENCLAUDE_QUERY_HARD_MAX_MS_ENV],
    MAX_CONFIGURABLE_QUERY_HARD_MAX_MS,
    false,
    log,
  )
  const idleMs = resolvePositiveIntEnv(
    OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV,
    env[OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV],
    MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS,
    false,
    log,
  )
  // Grace is additive on top of lease timeout, so 0 is a valid user choice.
  const leaseGraceMs = resolvePositiveIntEnv(
    OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV,
    env[OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV],
    MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS,
    true,
    log,
  )

  return {
    ...(hardMaxMs !== undefined && { hardMaxQueryMs: hardMaxMs }),
    ...(idleMs !== undefined && { idleTimeoutMs: idleMs }),
    ...(leaseGraceMs !== undefined && { toolLeaseGraceMs: leaseGraceMs }),
  }
}
