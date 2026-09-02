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
