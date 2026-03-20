const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
const MARKUP_CHARS = /<[^>]*>/g

export function sanitizeLogoText(text: string, maxLength: number = 24): string {
  const cleaned = text
    .replace(CONTROL_CHARS, '')
    .replace(MARKUP_CHARS, '')
    .trim()
    .slice(0, maxLength)
  return cleaned
}

export function isTextSafe(text: string): boolean {
  return !CONTROL_CHARS.test(text) && !MARKUP_CHARS.test(text)
}
