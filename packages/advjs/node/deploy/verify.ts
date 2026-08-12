import { DeployProjectError } from './index'

export interface VerifyDeploymentUrlOptions {
  fetch?: typeof fetch
  url: string
}

export interface DeploymentUrlVerification {
  resources: number
  spaFallback: true
  url: string
}

function requireSuccessfulResponse(response: Response, label: string) {
  if (!response.ok)
    throw new DeployProjectError('ADV_DEPLOY', `${label} returned HTTP ${response.status}`)
}

function requireMime(response: Response, expected: RegExp, label: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!expected.test(contentType))
    throw new DeployProjectError('ADV_DEPLOY', `${label} returned unexpected MIME type ${contentType || '(missing)'}`)
}

function referencedAssets(html: string, entryUrl: URL) {
  const results: string[] = []
  const seen = new Set<string>()
  const referencePattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/giu
  for (const match of html.matchAll(referencePattern)) {
    let url: URL
    try {
      url = new URL(match[1], entryUrl)
    }
    catch {
      continue
    }
    if (url.origin !== entryUrl.origin || !/\.(?:css|m?js)$/iu.test(url.pathname) || seen.has(url.href))
      continue
    seen.add(url.href)
    results.push(url.href)
  }
  return results
}

export async function verifyDeploymentUrl(options: VerifyDeploymentUrlOptions): Promise<DeploymentUrlVerification> {
  let entryUrl: URL
  try {
    entryUrl = new URL(options.url)
  }
  catch {
    throw new DeployProjectError('ADV_DEPLOY', 'Deployment verification requires a valid URL')
  }
  if (entryUrl.protocol !== 'https:')
    throw new DeployProjectError('ADV_DEPLOY', 'Deployment verification requires an HTTPS URL')
  const fetchImpl = options.fetch || globalThis.fetch

  try {
    const entryResponse = await fetchImpl(entryUrl.href, { headers: { accept: 'text/html' } })
    requireSuccessfulResponse(entryResponse, 'Deployment entry')
    requireMime(entryResponse, /^text\/html\b/iu, 'Deployment entry')
    const html = await entryResponse.text()
    const assets = referencedAssets(html, entryUrl)
    for (const asset of assets) {
      const response = await fetchImpl(asset)
      requireSuccessfulResponse(response, `Deployment resource ${asset}`)
      const pathname = new URL(asset).pathname
      requireMime(
        response,
        pathname.endsWith('.css') ? /^text\/css\b/iu : /(?:java|ecma)script/iu,
        `Deployment resource ${asset}`,
      )
    }

    const fallbackUrl = new URL('/__advjs_verify__/route', entryUrl)
    const fallbackResponse = await fetchImpl(fallbackUrl.href, { headers: { accept: 'text/html' } })
    requireSuccessfulResponse(fallbackResponse, 'Deployment SPA fallback')
    requireMime(fallbackResponse, /^text\/html\b/iu, 'Deployment SPA fallback')

    return { resources: assets.length, spaFallback: true, url: entryUrl.href }
  }
  catch (error) {
    if (error instanceof DeployProjectError)
      throw error
    throw new DeployProjectError('ADV_NETWORK', `Deployment URL verification failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}
