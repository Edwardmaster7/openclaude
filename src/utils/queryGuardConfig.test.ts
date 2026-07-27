import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_QUERY_HARD_MAX_MS } from './QueryGuard.js'
import {
  getQueryGuardOptionsFromEnv,
  MAX_CONFIGURABLE_QUERY_HARD_MAX_MS,
  MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS,
  MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS,
  OPENCLAUDE_QUERY_HARD_MAX_MS_ENV,
  OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV,
  OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV,
} from './queryGuardConfig.js'

describe('query guard config', () => {
  test('uses defaults when query hard max env is absent or empty', () => {
    const warn = vi.fn()

    expect(getQueryGuardOptionsFromEnv({}, warn)).toEqual({})
    expect(
      getQueryGuardOptionsFromEnv(
        { OPENCLAUDE_QUERY_HARD_MAX_MS: '   ' },
        warn,
      ),
    ).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  test('accepts positive finite integer query hard max values', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        { OPENCLAUDE_QUERY_HARD_MAX_MS: '3600000' },
        warn,
      ),
    ).toEqual({ hardMaxQueryMs: 3_600_000 })
    expect(
      getQueryGuardOptionsFromEnv(
        { OPENCLAUDE_QUERY_HARD_MAX_MS: String(DEFAULT_QUERY_HARD_MAX_MS) },
        warn,
      ),
    ).toEqual({ hardMaxQueryMs: DEFAULT_QUERY_HARD_MAX_MS })
    expect(
      getQueryGuardOptionsFromEnv(
        {
          OPENCLAUDE_QUERY_HARD_MAX_MS: String(
            MAX_CONFIGURABLE_QUERY_HARD_MAX_MS,
          ),
        },
        warn,
      ),
    ).toEqual({ hardMaxQueryMs: MAX_CONFIGURABLE_QUERY_HARD_MAX_MS })
    expect(warn).not.toHaveBeenCalled()
  })

  test('ignores invalid query hard max values with a clear warning', () => {
    const invalidValues = [
      '-1',
      'NaN',
      '1.5',
      'Infinity',
      '123abc',
      String(MAX_CONFIGURABLE_QUERY_HARD_MAX_MS + 1),
    ]

    for (const value of invalidValues) {
      const warn = vi.fn()

      expect(
        getQueryGuardOptionsFromEnv(
          { OPENCLAUDE_QUERY_HARD_MAX_MS: value },
          warn,
        ),
      ).toEqual({})

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain(
        'OPENCLAUDE_QUERY_HARD_MAX_MS',
      )
      expect(warn.mock.calls[0]?.[0]).toContain(value)
      expect(warn.mock.calls[0]?.[1]).toEqual({ level: 'warn' })
    }
  })

  test('accepts 0 for query hard max (disables the watchdog)', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        { OPENCLAUDE_QUERY_HARD_MAX_MS: '0' },
        warn,
      ),
    ).toEqual({ hardMaxQueryMs: 0 })
    expect(warn).not.toHaveBeenCalled()
  })

  test('uses defaults when query idle timeout env is absent or empty', () => {
    const warn = vi.fn()

    expect(getQueryGuardOptionsFromEnv({}, warn)).toEqual({})
    expect(
      getQueryGuardOptionsFromEnv(
        { [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: '   ' },
        warn,
      ),
    ).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  test('accepts positive finite integer query idle timeout values', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        { [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: '1800000' },
        warn,
      ),
    ).toEqual({ idleTimeoutMs: 1_800_000 })
    expect(
      getQueryGuardOptionsFromEnv(
        {
          [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: String(
            MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS,
          ),
        },
        warn,
      ),
    ).toEqual({ idleTimeoutMs: MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS })
    expect(warn).not.toHaveBeenCalled()
  })

  test('ignores invalid query idle timeout values with a clear warning', () => {
    const invalidValues = [
      '-1',
      'NaN',
      '1.5',
      'Infinity',
      '123abc',
      String(MAX_CONFIGURABLE_QUERY_IDLE_TIMEOUT_MS + 1),
    ]

    for (const value of invalidValues) {
      const warn = vi.fn()

      expect(
        getQueryGuardOptionsFromEnv(
          { [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: value },
          warn,
        ),
      ).toEqual({})

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain(
        OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV,
      )
      expect(warn.mock.calls[0]?.[0]).toContain(value)
    }
  })

  test('accepts 0 for query idle timeout (disables the watchdog)', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        { [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: '0' },
        warn,
      ),
    ).toEqual({ idleTimeoutMs: 0 })
    expect(warn).not.toHaveBeenCalled()
  })

  test('accepts zero for tool lease grace (additive on top of lease timeout)', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        { [OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV]: '0' },
        warn,
      ),
    ).toEqual({ toolLeaseGraceMs: 0 })
    expect(
      getQueryGuardOptionsFromEnv(
        { [OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV]: '30000' },
        warn,
      ),
    ).toEqual({ toolLeaseGraceMs: 30_000 })
    expect(
      getQueryGuardOptionsFromEnv(
        {
          [OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV]: String(
            MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS,
          ),
        },
        warn,
      ),
    ).toEqual({ toolLeaseGraceMs: MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS })
    expect(warn).not.toHaveBeenCalled()
  })

  test('ignores invalid tool lease grace values with a clear warning', () => {
    const invalidValues = [
      '-1',
      'NaN',
      '1.5',
      'Infinity',
      '30s',
      String(MAX_CONFIGURABLE_QUERY_TOOL_LEASE_GRACE_MS + 1),
    ]

    for (const value of invalidValues) {
      const warn = vi.fn()

      expect(
        getQueryGuardOptionsFromEnv(
          { [OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV]: value },
          warn,
        ),
      ).toEqual({})

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain(
        OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV,
      )
    }
  })

  test('resolves all three timeouts together when all env vars are set', () => {
    const warn = vi.fn()

    expect(
      getQueryGuardOptionsFromEnv(
        {
          [OPENCLAUDE_QUERY_HARD_MAX_MS_ENV]: '7200000',
          [OPENCLAUDE_QUERY_IDLE_TIMEOUT_MS_ENV]: '1800000',
          [OPENCLAUDE_QUERY_TOOL_LEASE_GRACE_MS_ENV]: '30000',
        },
        warn,
      ),
    ).toEqual({
      hardMaxQueryMs: 7_200_000,
      idleTimeoutMs: 1_800_000,
      toolLeaseGraceMs: 30_000,
    })
    expect(warn).not.toHaveBeenCalled()
  })
})
