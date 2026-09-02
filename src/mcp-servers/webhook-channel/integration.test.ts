import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildWebhookChannelServer } from './server.js'

// Protocol-level coverage: buildWebhookChannelServer + the MCP wiring
// (ListToolsRequestSchema / CallToolRequestSchema handlers) has zero
// coverage elsewhere — server.test.ts only exercises the pure helpers
// (SEND_MESSAGE_TOOL, handleSendMessageCall). This test drives the real
// SDK Server/Client over a linked in-memory transport pair to confirm
// the tool is actually reachable and dispatches through to `emit`.
describe('buildWebhookChannelServer (protocol round-trip)', () => {
  test('lists send_message and dispatches a real tool call through to emit', async () => {
    const emitted: string[] = []
    const server = buildWebhookChannelServer({
      emit: async content => {
        emitted.push(content)
      },
    })

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test-client', version: '1.0.0' })

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    const tools = await client.listTools()
    expect(tools.tools.map(t => t.name)).toContain('send_message')

    const result = await client.callTool({
      name: 'send_message',
      arguments: { content: 'test' },
    })

    expect(result.isError).toBeFalsy()
    expect(emitted).toEqual(['test'])
  })
})
