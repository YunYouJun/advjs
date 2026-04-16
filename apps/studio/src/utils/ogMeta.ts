/**
 * Dynamic Open Graph meta tag utilities.
 *
 * Updates `<meta property="og:*">` and `<meta name="twitter:*">` tags
 * so that link previews show project-specific info when sharing URLs.
 *
 * Note: SPA — social crawlers may not execute JS, so index.html has
 * sensible defaults. These functions enhance sharing for platforms
 * that do render JS (e.g. Telegram, Discord with embed unfurlers).
 *
 * @prebuilt Not yet wired into router guards. Will be integrated when
 * project-level share links are implemented.
 */

interface OgMetaOptions {
  title?: string
  description?: string
  image?: string
  url?: string
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

/**
 * Update OG meta tags for a project share link.
 */
export function setProjectOgMeta(options: OgMetaOptions): void {
  const title = options.title || 'ADV.JS Studio'
  const description = options.description || 'Create, play, and share interactive visual novels with AI-powered characters'
  const url = options.url || window.location.href

  document.title = title

  setMeta('og:title', title)
  setMeta('og:description', description)
  setMeta('og:url', url)
  setMeta('twitter:title', title)
  setMeta('twitter:description', description)

  if (options.image) {
    setMeta('og:image', options.image)
    setMeta('twitter:image', options.image)
  }
}

/**
 * Reset OG meta tags to defaults.
 */
export function resetOgMeta(): void {
  setProjectOgMeta({
    title: 'ADV.JS Studio',
    description: 'Create, play, and share interactive visual novels with AI-powered characters',
  })
}

/**
 * Build a share URL with project context.
 */
export function buildShareUrl(projectName?: string): string {
  const base = window.location.origin
  if (projectName)
    return `${base}/?project=${encodeURIComponent(projectName)}`
  return base
}
