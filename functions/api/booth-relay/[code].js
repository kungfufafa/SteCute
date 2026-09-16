import { handleBoothRelay, isBoothRelayCode } from '../../../../server/booth-relay.mjs'

export async function onRequest(context) {
  const code = String(context.params?.code || '').toUpperCase()
  if (!isBoothRelayCode(code)) {
    return json({ error: 'not_found' }, 404)
  }

  const url = new URL(context.request.url)
  const bodyText =
    context.request.method === 'POST' || context.request.method === 'PUT'
      ? await context.request.text()
      : ''

  const result = handleBoothRelay({
    method: context.request.method,
    pathname: `/api/booth-relay/${code}`,
    searchParams: url.searchParams,
    bodyText,
  })

  if (result.status === 204) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }

  return json(result.json, result.status)
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
