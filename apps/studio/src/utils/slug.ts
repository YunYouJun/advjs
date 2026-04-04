const SPACES_UNDERSCORES_RE = /[\s_]+/g
const NON_SLUG_CHARS_RE = /[^\w\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF-]/g
const MULTI_HYPHENS_RE = /-{2,}/g
const LEADING_TRAILING_HYPHENS_RE = /^-+|-+$/g

/**
 * Generate a filesystem/URL-safe slug from a display name.
 * CJK characters are preserved as-is (modern FS & COS handle UTF-8 fine).
 */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(SPACES_UNDERSCORES_RE, '-')
    .replace(NON_SLUG_CHARS_RE, '')
    .replace(MULTI_HYPHENS_RE, '-')
    .replace(LEADING_TRAILING_HYPHENS_RE, '')
}

/** Regex for validating a slug */
export const SLUG_RE = /^[\w\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF-]+$/
