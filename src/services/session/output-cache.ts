import type { SessionRenderResult } from './index'

// Keep only the current output in memory, including when IndexedDB cannot store it.
// This is deliberately not serialized: callers must offer download before page close.
let currentOutput: SessionRenderResult | null = null

export function rememberSessionOutput(output: SessionRenderResult): void {
  currentOutput = output
}

export function readSessionOutput(renderId: string): SessionRenderResult | null {
  return currentOutput?.render.id === renderId ? currentOutput : null
}

export function clearSessionOutput(): void {
  currentOutput = null
}
