const SPACES_UNDERSCORES_RE = /[\s_]+/g
// eslint-disable-next-line regexp/no-obscure-range -- CJK Unified Ideographs, Hiragana and Katakana stay in slugs.
const NON_SLUG_CHARS_RE = /[^\w一-鿿぀-ゟ゠-ヿ-]/g
const MULTI_HYPHENS_RE = /-{2,}/g
const LEADING_TRAILING_HYPHENS_RE = /^-+|-+$/g

/**
 * Generate a filesystem/URL-safe slug from a project display name.
 * CJK characters are preserved as-is (modern file systems and object storage handle UTF-8).
 */
export function toProjectSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(SPACES_UNDERSCORES_RE, '-')
    .replace(NON_SLUG_CHARS_RE, '')
    .replace(MULTI_HYPHENS_RE, '-')
    .replace(LEADING_TRAILING_HYPHENS_RE, '')
}

/** Valid project slug. */
// eslint-disable-next-line regexp/no-obscure-range -- same CJK ranges as above.
export const PROJECT_SLUG_RE = /^[\w一-鿿぀-ゟ゠-ヿ-]+$/
