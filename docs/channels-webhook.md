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
