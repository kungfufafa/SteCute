import type { IncomingMessage, ServerResponse } from 'node:http'

export function isBoothRelayCode(value: string): boolean
export function parseBoothRelayPath(pathname: string): string | null
export function listBoothRelayMessages(
  code: string,
  afterId?: string,
): Array<{ id: string; payload: unknown }>
export function appendBoothRelayMessage(code: string, payload: unknown): string
export function handleBoothRelay(input: {
  method: string
  pathname: string
  searchParams?: URLSearchParams
  bodyText?: string
}): { status: number; json: unknown }
export function createBoothRelayConnectMiddleware(): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void | Promise<void>
