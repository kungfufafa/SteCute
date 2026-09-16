import { handleBoothRelay } from '../../server/booth-relay.mjs'

export async function handler(event) {
  const queryCode = String(event.queryStringParameters?.code || '').toUpperCase()
  const pathname = event.path || ''
  const result = handleBoothRelay({
    method: event.httpMethod || 'GET',
    pathname: /booth-relay\/[A-Za-z0-9]+/i.test(pathname)
      ? pathname
      : queryCode
        ? `/api/booth-relay/${queryCode}`
        : pathname,
    searchParams: new URLSearchParams(
      event.rawQuery || toQuery(event.queryStringParameters),
    ),
    bodyText: event.body || '',
  })

  if (result.status === 204) {
    return { statusCode: 204, headers: { 'Cache-Control': 'no-store' } }
  }

  return {
    statusCode: result.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(result.json),
  }
}

function toQuery(params) {
  if (!params) return ''
  return new URLSearchParams(params).toString()
}
