const ROOM_TTL_MS = 30 * 60 * 1000
const MAX_MESSAGES = 80
const MAX_BODY_BYTES = 6 * 1024 * 1024

const rooms = globalThis.__stecuteBoothRooms ?? new Map()
globalThis.__stecuteBoothRooms = rooms

export function isBoothRelayCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value)
}

export function parseBoothRelayPath(pathname) {
  const match = String(pathname || '').match(/\/(?:api\/)?booth-relay\/([A-Za-z0-9]+)\/?$/)
  if (!match) return null
  const code = match[1].toUpperCase()
  return isBoothRelayCode(code) ? code : null
}

function getRoom(code) {
  const room = rooms.get(code)
  if (!room) return { messages: [] }
  if (Date.now() - room.touchedAt > ROOM_TTL_MS) {
    rooms.delete(code)
    return { messages: [] }
  }
  return room
}

export function listBoothRelayMessages(code, afterId) {
  const { messages } = getRoom(code)
  if (!afterId) return messages.map(({ id, payload }) => ({ id, payload }))
  const index = messages.findIndex((message) => message.id === afterId)
  const next = index === -1 ? messages : messages.slice(index + 1)
  return next.map(({ id, payload }) => ({ id, payload }))
}

export function appendBoothRelayMessage(code, payload) {
  const room = getRoom(code)
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const messages = [...room.messages, { id, payload, at: Date.now() }]
  rooms.set(code, {
    messages: messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages,
    touchedAt: Date.now(),
  })
  return id
}

export function handleBoothRelay({ method, pathname, searchParams, bodyText }) {
  const code = parseBoothRelayPath(pathname)
  if (!code) {
    return { status: 404, json: { error: 'not_found' } }
  }

  if (method === 'OPTIONS') {
    return { status: 204, json: null }
  }

  if (method === 'GET') {
    const afterId = searchParams?.get?.('after') || ''
    return { status: 200, json: { messages: listBoothRelayMessages(code, afterId) } }
  }

  if (method === 'POST') {
    if (bodyText && new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES) {
      return { status: 413, json: { error: 'too_large' } }
    }

    let parsed
    try {
      parsed = bodyText ? JSON.parse(bodyText) : {}
    } catch {
      return { status: 400, json: { error: 'invalid_json' } }
    }

    const payload = parsed?.payload
    if (!payload || typeof payload !== 'object') {
      return { status: 400, json: { error: 'missing_payload' } }
    }

    const id = appendBoothRelayMessage(code, payload)
    return { status: 201, json: { id } }
  }

  return { status: 405, json: { error: 'method_not_allowed' } }
}

export function createBoothRelayConnectMiddleware() {
  return async function boothRelayMiddleware(req, res, next) {
    const url = new URL(req.url || '', 'http://stecute.local')
    if (!parseBoothRelayPath(url.pathname)) {
      next()
      return
    }

    let bodyText = ''
    if (req.method === 'POST' || req.method === 'PUT') {
      bodyText = await readRequestBody(req, MAX_BODY_BYTES)
    }

    const result = handleBoothRelay({
      method: req.method || 'GET',
      pathname: url.pathname,
      searchParams: url.searchParams,
      bodyText,
    })

    res.statusCode = result.status
    res.setHeader('Cache-Control', 'no-store')
    if (result.json) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result.json))
      return
    }
    res.end()
  }
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
