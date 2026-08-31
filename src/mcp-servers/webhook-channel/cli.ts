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
