# Channels: local webhook (self-contained reference channel)

Channels let an external source — a chat app, a script, a monitoring
alert — push a message into a running OpenClaude session, and let the
model reply back out. This doc covers the bundled reference
implementation: a local webhook server with no external service
dependency.

## 1. Turn on Channels for your account

Add to `~/.openclaude/settings.json` (this fork's primary user-settings
path — it falls back to `~/.claude/settings.json` only if `~/.openclaude`
doesn't exist; or use `.claude/settings.json` / `.claude/settings.local.json`
for a project-scoped opt-in):

```json
{
  "channelsEnabled": true
}
```

This works without a claude.ai account — it's a local opt-in for
individual accounts. (Team/Enterprise accounts: this must be set in your
org's managed `policySettings`, and OAuth is still required — see
`docs/superpowers/specs/2026-08-31-local-mcp-channels-design.md`.)

## 2. Build and smoke-test the webhook channel server

```bash
bun run build
node bin/openclaude mcp serve-webhook-channel --port 8787 --token <pick-a-secret>
```

This is a smoke test only — confirm it logs
`webhook-channel: listening on http://127.0.0.1:8787/message`, then
**Ctrl-C it** before continuing to step 3. The real long-running instance
is launched automatically (as a subprocess of your `openclaude` session)
once you register it as a stdio MCP server in the next step — running it
manually *and* registering it would start two processes fighting over the
same port (the MCP-spawned one fails with `EADDRINUSE`, and the manually
launched one has no MCP client attached to it).

## 3. Register it as an MCP server

`openclaude mcp add` has no interactive prompt flow — pass the full
subprocess command directly, with `--` so `mcp add`'s own argument
parsing doesn't try to consume `--port`/`--token` as its own flags:

```bash
openclaude mcp add webhook -- node /absolute/path/to/repo/bin/openclaude mcp serve-webhook-channel --port 8787 --token <the-same-secret>
```

This registers `webhook` as a stdio MCP server whose command is
`node bin/openclaude mcp serve-webhook-channel --port 8787 --token <the-same-secret>`
— `openclaude` will spawn this itself in step 4, which is what actually
starts the long-running instance.

## 4. Start a session with the channel enabled

```bash
openclaude --dangerously-load-development-channels server:webhook
```

Pass the server name (`server:<the-name-you-gave-it>` — matching whatever
name you registered in step 3) directly as a value to
`--dangerously-load-development-channels`; that's what actually registers
it as a dev-trusted channel for this session, since this server isn't on
the built-in approved-plugins ledger. (There's no separate `--channels`
flag needed here — passing the name to
`--dangerously-load-development-channels` both allows and enables it.)
The flag requires at least one value, so it can't be passed bare, and
shows a confirmation dialog at startup.

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
