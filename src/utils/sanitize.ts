const MARKUP_CHARS = /<[^>]*>/g
const DELETE_CODE = 127

function removeControlCharacters(text: string): string {
  return Array.from(text)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== DELETE_CODE
    })
    .join('')
}

export function sanitizeLogoText(text: string, maxLength: number = 24): string {
  return removeControlCharacters(text)
    .replace(MARKUP_CHARS, '')
    .trim()
    .slice(0, maxLength)
}

export function isTextSafe(text: string): boolean {
  return removeControlCharacters(text) === text && !MARKUP_CHARS.test(text)
}
