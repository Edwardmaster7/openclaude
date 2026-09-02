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
