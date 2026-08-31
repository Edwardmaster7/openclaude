# Local MCP Channels — Design

## Goal

Make the existing (fully-implemented but dormant) MCP "Channels" mechanism
usable by an individual OpenClaude user, with zero dependency on a
claude.ai account, and ship a self-contained reference channel server so
the feature is end-to-end operational out of the box — not just
theoretically wired.

## Background

Channels let an MCP server push inbound messages into a running OpenClaude
session (`notifications/claude/channel`) and receive replies back out via
a normal MCP tool. The protocol, the connection-time gate
(`gateChannelServer()` in `src/services/mcp/channelNotification.ts`), and
~30 passing unit tests already exist in this repo — this was confirmed by
direct investigation (running `bun test` on
`channelNotification.test.ts`/`channelPermissions.test.ts`, and tracing
`gateChannelServer()`'s call site into `useManageMCPConnections.ts:623`
and the UI at `UserChannelMessage.tsx`).

Three independent gates currently keep it fully dark for every OpenClaude
user, discovered in order of increasing severity during this
investigation:

1. **Runtime flag `tengu_harbor`** (`isChannelsEnabled()` in
   `channelAllowlist.ts`) — defaults `false`, sourced from a GrowthBook
   stub that already supports local override
   (`~/.openclaude/feature-flags.json` or the `_openBuildDefaults` map in
   `src/services/analytics/growthbook.ts`).
2. **Hard claude.ai OAuth requirement** in `gateChannelServer()` — blocks
   any user without a real `claude.ai` OAuth token, unconditionally,
   before the org-policy/session/allowlist gates run.
3. **Build-time flag `KAIROS_CHANNELS`** (checked via
   `feature('KAIROS') || feature('KAIROS_CHANNELS')` from `bun:bundle`,
   resolved by `scripts/build.ts`'s `featureFlags` map at bundle time) —
   this is the most severe gate: it is `false` in this fork's build
   config (`KAIROS: false`, `KAIROS_CHANNELS` absent → defaults `false`),
   which means the `--channels` / `--dangerously-load-development-channels`
   CLI options, and every one of the ~20 call sites across
   `main.tsx`, `useManageMCPConnections.ts`, `interactiveHelpers.tsx`,
   `cli/print.ts`, tool implementations, and UI components, are
   **dead-code-eliminated from the compiled binary**. Without flipping
   this, none of the other gates matter — the feature doesn't exist in
   `bin/openclaude` at all.

Gate 3 was not visible from reading `channelNotification.ts` in
isolation; it only surfaced by tracing `--channels`'s registration in
`main.tsx:3699-3701` back to the `feature()` macro and then to
`scripts/build.ts`.

## Decisions

Confirmed with the user across this conversation:

- **Runtime scope:** individual (non-managed) users must be able to turn
  Channels on via their own `settings.json`, without logging into
  claude.ai. Managed (Team/Enterprise) accounts are unaffected — they
  keep today's exact behavior (org `policySettings.channelsEnabled` +
  OAuth).
- **Reference channel implementation:** a generic local webhook channel,
  not Telegram/Discord — chosen because it requires no external service
  registration, runs entirely on the user's machine, and is fully
  testable with `curl`. This directly satisfies the "self-contained,
  efficient, simple to configure" requirement without taking on a
  third-party API dependency.
- **Configuration surface:** reuse the product's existing `openclaude mcp
  add` interactive command to register the webhook server (no new UI is
  built). The only new plain-JSON setting a user hand-edits is
  `channelsEnabled: true`.

## Design

### 1. Build-time master switch

`scripts/build.ts`: add `KAIROS_CHANNELS: true` to the `featureFlags` map
(next to the other already-flipped, upstream-gated flags like
`VERIFICATION_AGENT: true`). This alone makes `--channels` and
`--dangerously-load-development-channels` appear in `bin/openclaude` and
un-dead-codes every channel call site. `KAIROS` itself stays `false` —
it gates a much larger, unrelated "persistent assistant/session mode"
feature this change must not turn on.

### 2. Runtime local opt-in

`src/services/mcp/channelAllowlist.ts` — new function:

```ts
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

`isChannelsEnabled()` becomes `isChannelsEnabledLocally() ||
getFeatureValue_CACHED_MAY_BE_STALE('tengu_harbor', false)` — every
existing caller of `isChannelsEnabled()` (the UI notice, `print.ts`,
`interactiveHelpers.tsx`, `gateChannelServer()`) picks up the new path
for free.

`src/services/mcp/channelNotification.ts` — `gateChannelServer()`'s OAuth
check changes from:

```ts
if (!getClaudeAIOAuthTokens()?.accessToken) {
  return { action: 'skip', kind: 'auth', reason: '...' }
}
```

to:

```ts
if (!isChannelsEnabledLocally() && !getClaudeAIOAuthTokens()?.accessToken) {
  return { action: 'skip', kind: 'auth', reason: '...' }
}
```

Managed accounts always have `isChannelsEnabledLocally() === false`, so
their OAuth requirement is untouched. The plugin/server allowlist gate
(the ledger + `--dangerously-load-development-channels` dev bypass)
is untouched — `channelsEnabled` decides whether the feature exists for
this account, not which specific server is trusted.

`src/utils/settings/types.ts` — update the `channelsEnabled` field's
`.describe()` text (schema already has the field; only the docstring
claims "Teams/Enterprise" exclusively today).

### 3. Self-contained reference channel: local webhook server

New directory `src/mcp-servers/webhook-channel/`:

- **`httpListener.ts`** — pure/testable pieces plus a thin `http.Server`
  wrapper:
  - `isAuthorized(authHeader: string | undefined, token: string): boolean`
    — expects `Authorization: Bearer <token>`.
  - `parseMessageBody(raw: string): { ok: true; value: { content: string; meta?: Record<string, string> } } | { ok: false; error: string }`
    — validates JSON shape (`content` required non-empty string, `meta`
    optional string-to-string record).
  - `createHttpListener(opts: { port: number; token: string; onMessage: (msg: { content: string; meta?: Record<string, string> }) => void }): http.Server`
    — binds `127.0.0.1:<port>` only (never `0.0.0.0`), handles
    `POST /message`: 401 on bad/missing auth, 400 on bad body, 202 + `{id}`
    on success (calls `onMessage` before responding).

- **`server.ts`** — `buildWebhookChannelServer(opts: { emit: (content: string, meta?: Record<string, string>) => Promise<void> }): Server`
  from `@modelcontextprotocol/sdk/server/index.js`, declaring
  `capabilities: { tools: {}, experimental: { 'claude/channel': {} } }`,
  registering `ListToolsRequestSchema` (one tool, `send_message`, input
  `{ content: string }`) and `CallToolRequestSchema` (calls
  `opts.emit(content)` and returns a text confirmation). Dependency
  injection on `emit` keeps this testable without a real transport.
  Deliberately does **not** declare `claude/channel/permission` —
  permission approvals ride the existing plain-text `y <code>` / `n
  <code>` relay already implemented in `channelPermissions.ts`, so this
  server doesn't need the separate structured-permission protocol for
  v1.

- **`cli.ts`** — `runWebhookChannelServer(argv: string[]): Promise<void>`:
  parses `--port <n>` (default `8787`) and `--token <secret>` (required;
  errors out with a clear message if missing — no silent unauthenticated
  fallback), builds the MCP server with `emit` wired to
  `server.notification({ method: 'notifications/claude/channel', params: { content, meta } })`,
  starts the HTTP listener with `onMessage` wired to the same `emit`,
  connects a `StdioServerTransport()`, and exits cleanly on stdin
  close/error (mirrors `runClaudeInChromeMcpServer()` in
  `src/utils/claudeInChrome/mcpServer.ts`).

### 4. CLI wiring

Mirrors the existing `mcp serve` subcommand exactly:

- `src/cli/handlers/mcp.tsx` — new `mcpServeWebhookChannelHandler({ port, token }): Promise<void>` that lazy-imports `./cli.js` from the new
  directory and calls `runWebhookChannelServer`.
- `src/main.tsx` — new `mcp.command('serve-webhook-channel')` registered
  right after the existing `mcp.command('serve')` block (main.tsx:3755),
  with `--port <n>` and `--token <secret>` options, lazy-importing the
  handler the same way `mcp serve` does.

No new CLI surface for *registering* the server with a running session —
users add it the same way they add any third-party MCP server, via the
existing `openclaude mcp add` interactive flow, pointing the command at
`openclaude mcp serve-webhook-channel --port 8787 --token <secret>`.

### 5. Docs

`docs/channels-webhook.md` — end-to-end walkthrough: set
`channelsEnabled: true`, `bun run build`, `openclaude mcp add` the
webhook command, launch `openclaude --channels server:<name>
--dangerously-load-development-channels`, `curl` a test message, see it
appear in the session, see the model's reply via `send_message`.

## Out of scope

- Telegram/Discord/iMessage channel implementations (future work, same
  protocol — noted in the original feature-gap research).
- The structured `claude/channel/permission` capability (text-relay
  approval already covers the dev/individual use case).
- Any change to managed (Team/Enterprise) org behavior.
- A new interactive UI for configuring the webhook server beyond the
  existing `mcp add` flow.
