# Local MCP Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenClaude's existing MCP "Channels" mechanism (inbound-message push into a session via `notifications/claude/channel`) usable end-to-end by an individual user with zero claude.ai account dependency, and ship a self-contained local webhook channel server so the feature is demonstrably operational, not just wired.

**Architecture:** Three layers, each independently testable: (1) a build-time feature flag flip that un-dead-codes the already-implemented channel call sites, (2) a runtime `channelsEnabled` settings toggle that lets non-managed accounts bypass the claude.ai OAuth requirement, and (3) a new self-contained MCP server package (`src/mcp-servers/webhook-channel/`) that speaks the channel protocol over a local authenticated HTTP listener, launched as a new `openclaude mcp serve-webhook-channel` subcommand.

**Tech Stack:** TypeScript, Bun test runner (`bun:test`), `@modelcontextprotocol/sdk` (already a dependency, `1.29.0`), Node's built-in `http` module (no new dependencies), Zod v4 (`zod/v4`, matching existing files in `src/services/mcp/`).

**Spec:** `docs/superpowers/specs/2026-08-31-local-mcp-channels-design.md`

## Global Constraints

- No new npm dependencies — the HTTP listener uses Node's built-in `http` module; the MCP server uses the already-installed `@modelcontextprotocol/sdk`.
- Managed (Team/Enterprise) account behavior must not change at all — every new local-opt-in path is gated on `getSubscriptionType()` not being `'team'`/`'enterprise'`.
- Follow existing file conventions exactly: `bun:test` (not vitest/jest), `zod/v4` imports (not bare `zod`) in `src/services/mcp/*`, 2-space indentation matching each file's existing style (note: `channelAllowlist.ts`/`channelNotification.ts` use 2-space; files under `src/cli/` and `src/mcp-servers/` (new) should also use 2-space to match the modules they sit beside).
- The webhook HTTP listener must bind to `127.0.0.1` only, never `0.0.0.0` — this is a local-only feature.
- All new/changed source files must pass `bun test` for their own suite before moving to the next task.

---

### Task 1: Flip the build-time `KAIROS_CHANNELS` flag

**Files:**
- Modify: `scripts/build.ts` (the `featureFlags` map, ~line 88, right after `KAIROS: false`)

**Interfaces:**
- Produces: `feature('KAIROS_CHANNELS')` now resolves to `true` at build time for every call site across the codebase (`main.tsx`, `useManageMCPConnections.ts`, `interactiveHelpers.tsx`, `cli/print.ts`, tool implementations, UI components — already-written code, no changes needed there).

- [ ] **Step 1: Add the flag**

In `scripts/build.ts`, find:

```ts
  KAIROS: false,                  // Persistent assistant/session mode (cloud backend)
```

Add immediately after it:

```ts
  KAIROS: false,                  // Persistent assistant/session mode (cloud backend)
  KAIROS_CHANNELS: true,          // MCP Channels: push external messages (webhook/bot) into a session
```

- [ ] **Step 2: Build and verify the flag took effect**

Run: `bun run build`

Expected: build succeeds with no errors.

- [ ] **Step 3: Verify the CLI flags are actually present in the compiled binary**

Run: `grep -c "MCP servers whose channel notifications" dist/cli.mjs`

Expected: `1` (the `--channels` option's description string, from `main.tsx:3700`, only survives minification if the `if (feature(...))` block wasn't dead-code-eliminated). Before this change this command returns `0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/build.ts
git commit -m "feat(channels): enable KAIROS_CHANNELS build flag"
```

---

### Task 2: `isChannelsEnabledLocally()` — local settings opt-in (TDD)

**Files:**
- Create: `src/services/mcp/channelAllowlist.test.ts`
- Modify: `src/services/mcp/channelAllowlist.ts`

**Interfaces:**
- Consumes: `getSettingsForSource(source: 'userSettings' | 'projectSettings' | 'localSettings' | 'policySettings'): SettingsJson | null` from `../../utils/settings/settings.js` (already imported elsewhere in this module's sibling `channelNotification.ts`); `getSubscriptionType(): SubscriptionType | null` from `../../utils/auth.js`.
- Produces: `export function isChannelsEnabledLocally(): boolean` — used by Task 3 and Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/services/mcp/channelAllowlist.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

let _mockSettings: Record<string, { channelsEnabled?: boolean } | null> = {}
let _mockSub: string | null = null

mock.module('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (source: string) => _mockSettings[source] ?? null,
}))
mock.module('../../utils/auth.js', () => ({
  getSubscriptionType: () => _mockSub,
}))

const { isChannelsEnabledLocally } = await import('./channelAllowlist.js')

beforeEach(() => {
  _mockSettings = {}
  _mockSub = null
})

afterEach(() => {
  mock.restore()
})

describe('isChannelsEnabledLocally', () => {
  test('false when no settings source has channelsEnabled', () => {
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('true when userSettings has channelsEnabled: true', () => {
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('true when projectSettings has channelsEnabled: true', () => {
    _mockSettings.projectSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('true when localSettings has channelsEnabled: true', () => {
    _mockSettings.localSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('false when channelsEnabled is present but false', () => {
    _mockSettings.userSettings = { channelsEnabled: false }
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('false for team subscription even with channelsEnabled: true locally', () => {
    _mockSub = 'team'
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('false for enterprise subscription even with channelsEnabled: true locally', () => {
    _mockSub = 'enterprise'
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/services/mcp/channelAllowlist.test.ts`

Expected: FAIL — `isChannelsEnabledLocally` is not exported from `./channelAllowlist.js`.

- [ ] **Step 3: Implement `isChannelsEnabledLocally()`**

In `src/services/mcp/channelAllowlist.ts`, add imports and the function (keep the existing `isChannelsEnabled()` untouched here — Task 3 wires them together):

```ts
import { getSubscriptionType } from '../../utils/auth.js'
import { getSettingsForSource } from '../../utils/settings/settings.js'
```

```ts
/**
 * Local opt-in for individual (non-managed) users — settings.json
 * `channelsEnabled: true` in user/project/local scope. Lets OpenClaude
 * users turn Channels on directly instead of depending on the
 * Anthropic-only tengu_harbor GrowthBook flag or a claude.ai account.
 * Managed (Team/Enterprise) accounts are excluded — those must go
 * through policySettings so org admins keep the trust decision (see
 * gateChannelServer's policy gate in channelNotification.ts).
 */
export function isChannelsEnabledLocally(): boolean {
  const sub = getSubscriptionType()
  if (sub === 'team' || sub === 'enterprise') return false
  return (
    getSettingsForSource('localSettings')?.channelsEnabled === true ||
    getSettingsForSource('projectSettings')?.channelsEnabled === true ||
    getSettingsForSource('userSettings')?.channelsEnabled === true
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/services/mcp/channelAllowlist.test.ts`

Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/mcp/channelAllowlist.ts src/services/mcp/channelAllowlist.test.ts
git commit -m "feat(channels): add isChannelsEnabledLocally settings-based opt-in"
```

---

### Task 3: Wire local opt-in into `isChannelsEnabled()`

**Files:**
- Modify: `src/services/mcp/channelAllowlist.ts`
- Modify: `src/services/mcp/channelAllowlist.test.ts`

**Interfaces:**
- Consumes: `isChannelsEnabledLocally()` (Task 2), `getFeatureValue_CACHED_MAY_BE_STALE` (already imported in this file).
- Produces: `isChannelsEnabled()` now returns `true` when either the local settings toggle or the `tengu_harbor` flag is on — every existing caller (`gateChannelServer`, `ChannelsNotice.tsx`, `interactiveHelpers.tsx`, `cli/print.ts`) picks this up with no changes on their side.

- [ ] **Step 1: Write the failing test**

Add to `src/services/mcp/channelAllowlist.test.ts` (inside a new `describe('isChannelsEnabled')` block, using the same `mock.module` setup already in the file — also mock `getFeatureValue_CACHED_MAY_BE_STALE` from `../analytics/growthbook.js`):

```ts
let _mockTenguHarbor = false

mock.module('../analytics/growthbook.js', () => ({
  getFeatureValue_CACHED_MAY_BE_STALE: (key: string, fallback: unknown) =>
    key === 'tengu_harbor' ? _mockTenguHarbor : fallback,
}))

describe('isChannelsEnabled', () => {
  beforeEach(() => {
    _mockTenguHarbor = false
  })

  test('false when neither tengu_harbor nor local settings are on', () => {
    expect(isChannelsEnabled()).toBe(false)
  })

  test('true when tengu_harbor is on', () => {
    _mockTenguHarbor = true
    expect(isChannelsEnabled()).toBe(true)
  })

  test('true when local settings toggle is on, independent of tengu_harbor', () => {
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabled()).toBe(true)
  })
})
```

Add the new `mock.module('../analytics/growthbook.js', ...)` call at the top of the file, grouped with the existing `mock.module` calls from Task 2 — `bun:test`'s `mock.module` calls must run before the first `await import('./channelAllowlist.js')` in the file. Then change Task 2's existing import line from:

```ts
const { isChannelsEnabledLocally } = await import('./channelAllowlist.js')
```

to:

```ts
const { isChannelsEnabledLocally, isChannelsEnabled } = await import('./channelAllowlist.js')
```

so both describe blocks share the one import.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/services/mcp/channelAllowlist.test.ts`

Expected: FAIL on `'true when local settings toggle is on...'` — current `isChannelsEnabled()` ignores local settings.

- [ ] **Step 3: Implement**

In `src/services/mcp/channelAllowlist.ts`, change:

```ts
export function isChannelsEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_harbor', false)
}
```

to:

```ts
export function isChannelsEnabled(): boolean {
  return (
    isChannelsEnabledLocally() ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_harbor', false)
  )
}
```

Also update this function's doc comment (currently: `/** Overall channels on/off. ... Default false; GrowthBook 5-min refresh. */`) to mention the local-settings path:

```ts
/**
 * Overall channels on/off. Checked before any per-server gating — when
 * false, --channels is a no-op and no handlers register. True when either
 * the user has set channelsEnabled: true locally (isChannelsEnabledLocally)
 * or the tengu_harbor GrowthBook flag is on. Default false.
 */
```

- [ ] **Step 4: Run the full file's tests to verify they pass**

Run: `bun test src/services/mcp/channelAllowlist.test.ts`

Expected: PASS, all 10 tests (7 from Task 2 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/services/mcp/channelAllowlist.ts src/services/mcp/channelAllowlist.test.ts
git commit -m "feat(channels): isChannelsEnabled honors local settings opt-in"
```

---

### Task 4: Skip the OAuth gate when locally enabled

**Files:**
- Modify: `src/services/mcp/channelNotification.ts`
- Modify: `src/services/mcp/channelNotification.test.ts`

**Interfaces:**
- Consumes: `isChannelsEnabledLocally()` from `./channelAllowlist.js` (Task 2).
- Produces: `gateChannelServer()` no longer returns `{action: 'skip', kind: 'auth'}` when `isChannelsEnabledLocally()` is true.

- [ ] **Step 1: Update the test mock to expose the new function**

In `src/services/mcp/channelNotification.test.ts`, the existing `mock.module('./channelAllowlist.js', ...)` block (around line 46) currently exports `isChannelsEnabled`, `getChannelAllowlist`, `isChannelAllowlisted`. Add a new mutable flag and export:

```ts
let _channelsEnabledLocally = false
```

(add next to the existing `let _channelsEnabled = true` declaration), and add to the `mock.module('./channelAllowlist.js', () => ({ ... }))` object:

```ts
  isChannelsEnabledLocally: () => _channelsEnabledLocally,
```

Reset it in the existing `beforeEach`:

```ts
  _channelsEnabledLocally = false
```

(add next to the existing `_channelsEnabled = true` line inside `beforeEach`).

- [ ] **Step 2: Write the failing tests**

Add to the `describe('gateChannelServer', ...)` block in `channelNotification.test.ts`, near the existing OAuth-gate test (`'skips when no OAuth access token is present'`):

```ts
  test('OAuth gate is skipped when channels are enabled locally', () => {
    _channelsEnabledLocally = true
    _mockOAuthTokens = {} // no accessToken
    setAllowedChannels([{ kind: 'server', name: 'slack', dev: true }])
    const result = gateChannelServer('slack', cap(), undefined)
    expect(result.action).toBe('register')
  })

  test('OAuth gate still applies when channels are NOT enabled locally', () => {
    _channelsEnabledLocally = false
    _mockOAuthTokens = {} // no accessToken
    setAllowedChannels([{ kind: 'server', name: 'slack', dev: true }])
    const result = gateChannelServer('slack', cap(), undefined)
    if (result.action !== 'skip') {
      throw new Error(`expected skip, got ${result.action}`)
    }
    expect(result.kind).toBe('auth')
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/services/mcp/channelNotification.test.ts`

Expected: FAIL on `'OAuth gate is skipped when channels are enabled locally'` (gate still returns `kind: 'auth'`), and a TypeScript/runtime error if `isChannelsEnabledLocally` isn't imported yet in `channelNotification.ts`.

- [ ] **Step 4: Implement**

In `src/services/mcp/channelNotification.ts`, update the import:

```ts
import {
  type ChannelAllowlistEntry,
  getChannelAllowlist,
  isChannelsEnabled,
  isChannelsEnabledLocally,
} from './channelAllowlist.js'
```

And change the OAuth check inside `gateChannelServer()`:

```ts
  if (!getClaudeAIOAuthTokens()?.accessToken) {
    return {
      action: 'skip',
      kind: 'auth',
      reason: 'channels requires claude.ai authentication (run /login)',
    }
  }
```

to:

```ts
  // API-key / non-Anthropic users skip this entirely once they've
  // explicitly opted in via channelsEnabled: true locally — that setting
  // IS the informed-consent signal claude.ai OAuth otherwise provides.
  if (
    !isChannelsEnabledLocally() &&
    !getClaudeAIOAuthTokens()?.accessToken
  ) {
    return {
      action: 'skip',
      kind: 'auth',
      reason: 'channels requires claude.ai authentication (run /login), or set channelsEnabled: true in your settings.json',
    }
  }
```

Also update the file's top doc comment (lines 13-16), which currently reads:

```
 * feature('KAIROS') || feature('KAIROS_CHANNELS'). Runtime gate tengu_harbor.
 * Requires claude.ai OAuth auth — API key users are blocked until
 * console gets a channelsEnabled admin surface. Teams/Enterprise orgs
 * must explicitly opt in via channelsEnabled: true in managed settings.
```

to:

```
 * feature('KAIROS') || feature('KAIROS_CHANNELS'). Runtime gate tengu_harbor,
 * or a local channelsEnabled: true setting (see isChannelsEnabledLocally).
 * Requires claude.ai OAuth auth UNLESS the user has set channelsEnabled: true
 * locally — that explicit opt-in substitutes for OAuth for individual
 * accounts. Teams/Enterprise orgs must explicitly opt in via
 * channelsEnabled: true in managed settings, and always require OAuth.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/services/mcp/channelNotification.test.ts src/services/mcp/channelPermissions.test.ts`

Expected: PASS, all 33 tests (31 existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/services/mcp/channelNotification.ts src/services/mcp/channelNotification.test.ts
git commit -m "feat(channels): skip claude.ai OAuth gate when channelsEnabled is set locally"
```

---

### Task 5: Update the `channelsEnabled` settings schema description

**Files:**
- Modify: `src/utils/settings/types.ts`

**Interfaces:**
- None (documentation-only; the zod field type itself is unchanged, so no other file is affected).

- [ ] **Step 1: Update the description text**

In `src/utils/settings/types.ts`, find (around line 1177-1192):

```ts
      // Teams/Enterprise opt-IN for channel notifications. Default OFF.
      // MCP servers that declare the claude/channel capability can push
      // inbound messages into the conversation; for managed orgs this only
      // works when explicitly enabled. Which servers can connect at all is
      // still governed by allowedMcpServers/deniedMcpServers. Not
      // feature-spread: KAIROS_CHANNELS is external:true, and the spread
      // wrecks type inference for allowedChannelPlugins (the .passthrough()
      // catch-all gives {} instead of the array type).
      channelsEnabled: z
        .boolean()
        .optional()
        .describe(
          'Teams/Enterprise opt-in for channel notifications (MCP servers with the ' +
            'claude/channel capability pushing inbound messages). Default off. ' +
            'Set true to allow; users then select servers via --channels.',
        ),
```

Replace with:

```ts
      // Opt-IN for channel notifications. Default OFF. MCP servers that
      // declare the claude/channel capability can push inbound messages
      // into the conversation. Which servers can connect at all is still
      // governed by allowedMcpServers/deniedMcpServers. For individual
      // (non-managed) accounts, setting this true in userSettings/
      // projectSettings/localSettings also bypasses the claude.ai OAuth
      // requirement (see isChannelsEnabledLocally in channelAllowlist.ts).
      // Managed (Team/Enterprise) accounts must set this in policySettings
      // specifically and always still require OAuth. Not feature-spread:
      // KAIROS_CHANNELS is external:true, and the spread wrecks type
      // inference for allowedChannelPlugins (the .passthrough() catch-all
      // gives {} instead of the array type).
      channelsEnabled: z
        .boolean()
        .optional()
        .describe(
          'Opt-in for channel notifications (MCP servers with the claude/channel ' +
            'capability pushing inbound messages). Default off. Set true to allow; ' +
            'users then select servers via --channels. For individual accounts this ' +
            'also skips the claude.ai OAuth requirement. Team/Enterprise accounts ' +
            'must set this in managed settings and always require OAuth.',
        ),
```

- [ ] **Step 2: Verify the schema still parses**

Run: `bun test src/utils/settings/ --grep channels 2>&1 | tail -20`

If no test matches (this field has no dedicated schema test today), instead run the broader settings test suite to confirm nothing broke:

Run: `bun test src/utils/settings/settings.transaction.test.ts`

Expected: PASS (unchanged — this task only touched a `.describe()` string, not the schema shape).

- [ ] **Step 3: Commit**

```bash
git add src/utils/settings/types.ts
git commit -m "docs(settings): clarify channelsEnabled works for individual accounts too"
```

---

### Task 6: `httpListener.ts` — authenticated local HTTP listener (TDD)

**Files:**
- Create: `src/mcp-servers/webhook-channel/httpListener.ts`
- Create: `src/mcp-servers/webhook-channel/httpListener.test.ts`

**Interfaces:**
- Produces:
  - `export function isAuthorized(authHeader: string | undefined, token: string): boolean`
  - `export type ParsedMessage = { content: string; meta?: Record<string, string> }`
  - `export function parseMessageBody(raw: string): { ok: true; value: ParsedMessage } | { ok: false; error: string }`
  - `export function createHttpListener(opts: { port: number; token: string; onMessage: (msg: ParsedMessage) => void }): import('node:http').Server`
- Consumed by: Task 8 (`cli.ts`).

- [ ] **Step 1: Write the failing tests**

Create `src/mcp-servers/webhook-channel/httpListener.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/mcp-servers/webhook-channel/httpListener.test.ts`

Expected: FAIL — `./httpListener.js` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/mcp-servers/webhook-channel/httpListener.ts`:

```ts
import { createServer, type Server } from 'node:http'

export function isAuthorized(
  authHeader: string | undefined,
  token: string,
): boolean {
  if (!authHeader) return false
  const match = /^Bearer (.+)$/.exec(authHeader)
  if (!match) return false
  return match[1] === token
}

export type ParsedMessage = {
  content: string
  meta?: Record<string, string>
}

export function parseMessageBody(
  raw: string,
): { ok: true; value: ParsedMessage } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'body is not valid JSON' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'body must be a JSON object' }
  }

  const { content, meta } = parsed as Record<string, unknown>

  if (typeof content !== 'string' || content.length === 0) {
    return { ok: false, error: 'content must be a non-empty string' }
  }

  if (meta !== undefined) {
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
      return { ok: false, error: 'meta must be an object' }
    }
    for (const value of Object.values(meta as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        return { ok: false, error: 'meta values must be strings' }
      }
    }
  }

  return {
    ok: true,
    value: {
      content,
      ...(meta !== undefined ? { meta: meta as Record<string, string> } : {}),
    },
  }
}

/**
 * Local-only authenticated HTTP listener for the webhook channel. Binds
 * 127.0.0.1 exclusively — this is never meant to be reachable off-machine;
 * remote delivery is the caller's responsibility (their own reverse proxy,
 * tunnel, etc.), not this server's.
 */
export function createHttpListener(opts: {
  port: number
  token: string
  onMessage: (msg: ParsedMessage) => void
}): Server {
  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/message') {
      res.writeHead(404).end()
      return
    }

    if (!isAuthorized(req.headers.authorization, opts.token)) {
      res.writeHead(401).end('unauthorized')
      return
    }

    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      const parsed = parseMessageBody(raw)
      if (!parsed.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: parsed.error }))
        return
      }
      opts.onMessage(parsed.value)
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: crypto.randomUUID() }))
    })
  })

  return server
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/mcp-servers/webhook-channel/httpListener.test.ts`

Expected: PASS, all 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-servers/webhook-channel/httpListener.ts src/mcp-servers/webhook-channel/httpListener.test.ts
git commit -m "feat(channels): add webhook channel HTTP listener"
```

---

### Task 7: `server.ts` — MCP server with `send_message` tool (TDD)

Following the convention already established in `src/entrypoints/mcp.ts` /
`mcp.test.ts`: the SDK `Server` wiring itself (`server.setRequestHandler`)
is a thin, untested shell — all actual logic lives in plain exported
functions tested directly, with no reach into the SDK's private
internals (`Server`'s `_requestHandlers`/`_capabilities` are private
fields, not a public test seam).

**Files:**
- Create: `src/mcp-servers/webhook-channel/server.ts`
- Create: `src/mcp-servers/webhook-channel/server.test.ts`

**Interfaces:**
- Consumes: `Server` from `@modelcontextprotocol/sdk/server/index.js`; `ListToolsRequestSchema`, `CallToolRequestSchema`, `type Tool`, `type CallToolResult` from `@modelcontextprotocol/sdk/types.js`.
- Produces:
  - `export const SEND_MESSAGE_TOOL: Tool` — the tool definition, tested directly.
  - `export async function handleSendMessageCall(args: unknown, emit: (content: string, meta?: Record<string, string>) => Promise<void>): Promise<CallToolResult>` — the tool-call logic, tested directly.
  - `export function buildWebhookChannelServer(opts: { emit: (content: string, meta?: Record<string, string>) => Promise<void> }): Server` — thin wiring, not directly unit-tested (consistent with `startMCPServer` in `entrypoints/mcp.ts`); exercised by the Task 9 manual smoke test instead.
- Consumed by: Task 8 (`cli.ts`).

- [ ] **Step 1: Write the failing tests**

Create `src/mcp-servers/webhook-channel/server.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/mcp-servers/webhook-channel/server.test.ts`

Expected: FAIL — `./server.js` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/mcp-servers/webhook-channel/server.ts`:

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type ListToolsResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

export const CAPABILITIES = {
  tools: {},
  experimental: {
    'claude/channel': {},
  },
} as const

export const SEND_MESSAGE_TOOL: Tool = {
  name: 'send_message',
  description:
    'Send a message out through this channel, back to whoever sent the inbound message.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Message text to send.' },
    },
    required: ['content'],
  },
}

export async function handleSendMessageCall(
  args: unknown,
  emit: (content: string, meta?: Record<string, string>) => Promise<void>,
): Promise<CallToolResult> {
  const content = (args as { content?: unknown } | null)?.content

  if (typeof content !== 'string' || content.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'content must be a non-empty string' }],
    }
  }

  await emit(content)

  return {
    content: [{ type: 'text', text: 'Message sent.' }],
  }
}

/**
 * Builds the webhook channel's MCP server. `emit` is called when the
 * model uses send_message to reply out through the channel — the caller
 * (cli.ts) wires this to the transport that actually delivers it (for
 * this reference implementation, a log line; a real channel would POST
 * to Telegram/Discord/etc. here).
 *
 * No claude/channel/permission capability — permission approvals ride the
 * plain-text y/n relay already implemented in channelPermissions.ts, so
 * this server doesn't need the structured protocol for v1.
 *
 * Thin wiring only — no logic lives here beyond dispatch, matching the
 * convention in src/entrypoints/mcp.ts (startMCPServer is untested
 * directly; its helpers getCombinedTools/loadReexposedMcpTools are).
 */
export function buildWebhookChannelServer(opts: {
  emit: (content: string, meta?: Record<string, string>) => Promise<void>
}): Server {
  const server = new Server(
    { name: 'openclaude-webhook-channel', version: '1.0.0' },
    { capabilities: CAPABILITIES },
  )

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (): Promise<ListToolsResult> => ({ tools: [SEND_MESSAGE_TOOL] }),
  )

  server.setRequestHandler(
    CallToolRequestSchema,
    async ({ params: { name, arguments: args } }): Promise<CallToolResult> => {
      if (name !== SEND_MESSAGE_TOOL.name) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        }
      }
      return handleSendMessageCall(args, opts.emit)
    },
  )

  return server
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/mcp-servers/webhook-channel/server.test.ts`

Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-servers/webhook-channel/server.ts src/mcp-servers/webhook-channel/server.test.ts
git commit -m "feat(channels): add webhook channel MCP server with send_message tool"
```

---

### Task 8: `cli.ts` — wire stdio transport, HTTP listener, and argv parsing (TDD for argv parsing)

**Files:**
- Create: `src/mcp-servers/webhook-channel/cli.ts`
- Create: `src/mcp-servers/webhook-channel/cli.test.ts`

**Interfaces:**
- Consumes: `createHttpListener` (Task 6), `buildWebhookChannelServer` (Task 7), `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
- Produces:
  - `export function parseWebhookChannelArgs(argv: string[]): { port: number; token: string } | { error: string }`
  - `export async function runWebhookChannelServer(argv: string[]): Promise<void>`
- Consumed by: Task 9 (`src/cli/handlers/mcp.tsx`).

- [ ] **Step 1: Write the failing tests for argv parsing**

Create `src/mcp-servers/webhook-channel/cli.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/mcp-servers/webhook-channel/cli.test.ts`

Expected: FAIL — `./cli.js` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/mcp-servers/webhook-channel/cli.ts`:

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHttpListener } from './httpListener.js'
import { buildWebhookChannelServer } from './server.js'

const DEFAULT_PORT = 8787

export function parseWebhookChannelArgs(
  argv: string[],
): { port: number; token: string } | { error: string } {
  let port = DEFAULT_PORT
  let token: string | undefined

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') {
      const raw = argv[i + 1]
      const parsed = Number(raw)
      if (!raw || Number.isNaN(parsed)) {
        return { error: `--port must be a number, got: ${raw}` }
      }
      port = parsed
      i++
    } else if (argv[i] === '--token') {
      token = argv[i + 1]
      i++
    }
  }

  if (!token) {
    return {
      error:
        '--token is required (a shared secret callers must send as `Authorization: Bearer <token>`)',
    }
  }

  return { port, token }
}

/**
 * Entry point for `openclaude mcp serve-webhook-channel`. Mirrors the
 * shutdown-on-stdin-close pattern used by runClaudeInChromeMcpServer in
 * src/utils/claudeInChrome/mcpServer.ts.
 */
export async function runWebhookChannelServer(argv: string[]): Promise<void> {
  const parsed = parseWebhookChannelArgs(argv)
  if ('error' in parsed) {
    process.stderr.write(`webhook-channel: ${parsed.error}\n`)
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }
  const { port, token } = parsed

  // Outbound (model → channel): this reference implementation logs to
  // stderr. A real deployment would POST to whatever delivered the
  // inbound message (using the meta the inbound POST carried).
  const server = buildWebhookChannelServer({
    emit: async content => {
      process.stderr.write(`webhook-channel: send_message → ${content}\n`)
    },
  })

  // Inbound (channel → model): forward as notifications/claude/channel.
  // Cast: this Server instance's generic NotificationT is the SDK's base
  // ServerNotification union, which doesn't include this app-specific
  // method — same asymmetry documented for the client-sent
  // channel/permission_request notification in channelNotification.ts.
  const httpServer = createHttpListener({
    port,
    token,
    onMessage: msg => {
      void server.notification({
        method: 'notifications/claude/channel',
        params: { content: msg.content, meta: msg.meta },
      } as Parameters<typeof server.notification>[0])
    },
  })
  httpServer.listen(port, '127.0.0.1', () => {
    process.stderr.write(
      `webhook-channel: listening on http://127.0.0.1:${port}/message\n`,
    )
  })

  let exiting = false
  const shutdownAndExit = (): void => {
    if (exiting) return
    exiting = true
    httpServer.close()
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }
  process.stdin.on('end', shutdownAndExit)
  process.stdin.on('error', shutdownAndExit)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
```

- [ ] **Step 4: Run the argv-parsing tests to verify they pass**

Run: `bun test src/mcp-servers/webhook-channel/cli.test.ts`

Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-servers/webhook-channel/cli.ts src/mcp-servers/webhook-channel/cli.test.ts
git commit -m "feat(channels): add webhook channel CLI entrypoint"
```

---

### Task 9: Wire the `openclaude mcp serve-webhook-channel` subcommand

**Files:**
- Modify: `src/cli/handlers/mcp.tsx`
- Modify: `src/main.tsx` (around line 3769, right after the existing `mcp.command('serve')` registration)

**Interfaces:**
- Consumes: `runWebhookChannelServer` (Task 8).
- Produces: a new CLI subcommand, `openclaude mcp serve-webhook-channel --port <n> --token <secret>`.

- [ ] **Step 1: Add the handler**

In `src/cli/handlers/mcp.tsx`, add after `mcpServeHandler` (after line 173):

```ts
// mcp serve-webhook-channel — launches the bundled reference webhook
// channel MCP server (src/mcp-servers/webhook-channel/).
export async function mcpServeWebhookChannelHandler({
  port,
  token,
}: {
  port?: string;
  token?: string;
}): Promise<void> {
  const {
    runWebhookChannelServer
  } = await import('../../mcp-servers/webhook-channel/cli.js');
  const argv: string[] = [];
  if (port) argv.push('--port', port);
  if (token) argv.push('--token', token);
  await runWebhookChannelServer(argv);
}
```

- [ ] **Step 2: Register the subcommand**

In `src/main.tsx`, immediately after the existing block (main.tsx:3755-3769):

```ts
  mcp.command('serve').description(`Start the OpenClaude MCP server`).option('-d, --debug', 'Enable debug mode', () => true).option('--verbose', 'Override verbose mode setting from config', () => true).action(async ({
    debug,
    verbose
  }: {
    debug?: boolean;
    verbose?: boolean;
  }) => {
    const {
      mcpServeHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpServeHandler({
      debug,
      verbose
    });
  });
```

add:

```ts
  mcp.command('serve-webhook-channel').description('Start the bundled local webhook channel MCP server (requires channelsEnabled: true in settings.json and --channels at launch — see docs/channels-webhook.md)').option('--port <n>', 'HTTP listener port (default 8787)').option('--token <secret>', 'Shared secret callers must send as `Authorization: Bearer <token>` (required)').action(async ({
    port,
    token
  }: {
    port?: string;
    token?: string;
  }) => {
    const {
      mcpServeWebhookChannelHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpServeWebhookChannelHandler({
      port,
      token
    });
  });
```

- [ ] **Step 3: Build and manually smoke-test**

Run: `bun run build`

Then, in one terminal:

```bash
node bin/openclaude mcp serve-webhook-channel --port 8787 --token test123
```

Expected stderr output: `webhook-channel: listening on http://127.0.0.1:8787/message`

In a second terminal, verify the auth gate:

```bash
curl -i -X POST http://127.0.0.1:8787/message -d '{"content":"hi"}'
```

Expected: `HTTP/1.1 401`

Then with the token:

```bash
curl -i -X POST http://127.0.0.1:8787/message \
  -H 'Authorization: Bearer test123' \
  -d '{"content":"hi"}'
```

Expected: `HTTP/1.1 202` with a JSON body containing an `id`. Stop the process with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/cli/handlers/mcp.tsx src/main.tsx
git commit -m "feat(channels): register mcp serve-webhook-channel subcommand"
```

---

### Task 10: End-to-end documentation

**Files:**
- Create: `docs/channels-webhook.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Write the doc**

Create `docs/channels-webhook.md`:

````markdown
# Channels: local webhook (self-contained reference channel)

Channels let an external source — a chat app, a script, a monitoring
alert — push a message into a running OpenClaude session, and let the
model reply back out. This doc covers the bundled reference
implementation: a local webhook server with no external service
dependency.

## 1. Turn on Channels for your account

Add to `~/.claude/settings.json` (or `.claude/settings.json` /
`.claude/settings.local.json` for a project-scoped opt-in):

```json
{
  "channelsEnabled": true
}
```

This works without a claude.ai account — it's a local opt-in for
individual accounts. (Team/Enterprise accounts: this must be set in your
org's managed `policySettings`, and OAuth is still required — see
`docs/superpowers/specs/2026-08-31-local-mcp-channels-design.md`.)

## 2. Build and start the webhook channel server

```bash
bun run build
node bin/openclaude mcp serve-webhook-channel --port 8787 --token <pick-a-secret>
```

Keep this running in its own terminal — it's a standalone MCP server
process. It logs `webhook-channel: listening on http://127.0.0.1:8787/message`
when ready.

## 3. Register it as an MCP server

In your project (or globally), run the normal interactive flow:

```bash
openclaude mcp add
```

When prompted, point it at:

- **command:** `node`
- **args:** `bin/openclaude mcp serve-webhook-channel --port 8787 --token <the-same-secret>`

(Or add directly to `.mcp.json` — see `openclaude mcp add --help` for the
non-interactive form.)

## 4. Start a session with the channel enabled

```bash
openclaude --channels server:<the-name-you-gave-it> --dangerously-load-development-channels
```

`--dangerously-load-development-channels` is required because this
server isn't on the built-in approved-plugins ledger — that flag is the
documented local-dev bypass for exactly this case, and shows a
confirmation dialog at startup.

## 5. Send a message in

```bash
curl -X POST http://127.0.0.1:8787/message \
  -H 'Authorization: Bearer <the-same-secret>' \
  -d '{"content": "What is 2+2?"}'
```

The message appears in your OpenClaude session wrapped in a `<channel>`
tag, and the model can reply using its `send_message` tool — in this
reference implementation, replies are logged to the webhook server's
stderr (swap the `emit` callback in
`src/mcp-servers/webhook-channel/cli.ts` for a real outbound delivery —
POST to Telegram/Discord/Slack/etc. — to make replies round-trip
somewhere a human sees them).

## Notes

- The HTTP listener binds `127.0.0.1` only — it is not reachable from
  other machines. Put a tunnel (ngrok, Cloudflare Tunnel, a reverse
  proxy with its own auth) in front of it if you need remote delivery.
- The `--token` you choose is a bearer secret — anyone with it can inject
  messages into your session. Treat it like a password.
- This reference server implements text relay only (no structured
  permission-approval protocol) — a permission dialog is relayed as
  plain text (`y <code>` / `n <code>`) through the same channel.
````

- [ ] **Step 2: Commit**

```bash
git add docs/channels-webhook.md
git commit -m "docs(channels): add webhook channel setup guide"
```

---

## Final Verification

- [ ] **Run the full targeted test suite**

Run: `bun test src/services/mcp/channelAllowlist.test.ts src/services/mcp/channelNotification.test.ts src/services/mcp/channelPermissions.test.ts src/mcp-servers/webhook-channel/`

Expected: all PASS, 0 fail.

- [ ] **Full production build succeeds**

Run: `bun run build`

Expected: no errors.

- [ ] **Manual end-to-end smoke test**

Follow `docs/channels-webhook.md` steps 1-5 in full, using a real running `openclaude` session (not just the standalone server), and confirm a `curl`-sent message actually appears in the session transcript.
