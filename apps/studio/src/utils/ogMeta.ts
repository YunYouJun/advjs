/**
 * Dynamic Open Graph meta tag utilities.
 *
 * Updates `<meta property="og:*">` and `<meta name="twitter:*">` tags
 * so that link previews show project-specific info when sharing URLs.
 *
 * Note: SPA — social crawlers may not execute JS, so index.html has
 * sensible defaults. These functions enhance sharing for platforms
 * that do render JS (e.g. Telegram, Discord with embed unfurlers).
 */

interface OgMetaOptions {
  title?: string
  description?: string
  image?: string
  url?: string
  /** OG type: website | article | etc. */
  type?: string
}

function setMeta(property: string, content: string): void {
  let el = document.querySelector(`meta[property="${property}"]`)
    || document.querySelector(`meta[name="${property}"]`)
  if (el) {
    el.setAttribute('content', content)
  }
  else {
    el = document.createElement('meta')
    if (property.startsWith('og:'))
      el.setAttribute('property', property)
    else
      el.setAttribute('name', property)
    el.setAttribute('content', content)
    document.head.appendChild(el)
  }
}

const DEFAULT_TITLE = 'ADV.JS Studio'
const DEFAULT_DESCRIPTION = 'Create, play, and share interactive visual novels with AI-powered characters'

/**
 * Update OG meta tags for a project share link.
 */
export function setProjectOgMeta(options: OgMetaOptions): void {
  const title = options.title || DEFAULT_TITLE
  const description = options.description || DEFAULT_DESCRIPTION
  const url = options.url || window.location.href
  const type = options.type || 'website'

  document.title = title

  setMeta('og:title', title)
  setMeta('og:description', description)
  setMeta('og:url', url)
  setMeta('og:type', type)
  setMeta('og:site_name', DEFAULT_TITLE)

  // Twitter Card
  setMeta('twitter:card', options.image ? 'summary_large_image' : 'summary')
  setMeta('twitter:title', title)
  setMeta('twitter:description', description)

  // WeChat/QQ use these non-standard but widely-respected tags
  setMeta('description', description)

  if (options.image) {
    setMeta('og:image', options.image)
    setMeta('og:image:alt', title)
    setMeta('twitter:image', options.image)
  }
}

/**
 * Set OG meta for a character share context (e.g. chat page).
 */
export function setCharacterOgMeta(options: {
  characterName: string
  projectName?: string
  description?: string
  image?: string
}): void {
  setProjectOgMeta({
    title: options.projectName
      ? `${options.characterName} · ${options.projectName}`
      : `${options.characterName} — ${DEFAULT_TITLE}`,
    description: options.description
      || `Chat with ${options.characterName}, an AI character created with ADV.JS Studio.`,
    image: options.image,
    type: 'profile',
  })
}

/**
 * Reset OG meta tags to defaults.
 */
export function resetOgMeta(): void {
  setProjectOgMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  })
}

/**
 * Build a share URL with project context.
 *
 * Format: https://studio.advjs.org/share/{projectId}
 * When no projectId provided, falls back to root URL.
 */
export function buildShareUrl(projectId?: string): string {
  const base = window.location.origin
  if (projectId)
    return `${base}/share/${encodeURIComponent(projectId)}`
  return base
}

/**
 * Build a deep-link URL that will auto-import a project on arrival.
 * Used in QR codes and social share cards.
 */
export function buildImportUrl(projectId: string): string {
  return `${window.location.origin}/?import=${encodeURIComponent(projectId)}`
}
