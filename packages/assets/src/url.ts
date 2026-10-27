/**
 * Pure-JS parsing for the one URL shape asset metadata accepts: an absolute
 * public HTTPS page without credentials, query or fragment.
 *
 * Hosts such as JavaScriptCore have no WHATWG `URL`, and a hand-written full
 * URL parser would drift from browsers. This accepts a conservative subset
 * instead, for which the result always equals `new URL(input).href`; inputs
 * outside the subset are rejected rather than normalized differently.
 */

const SCHEME_RE = /^[a-z][a-z\d+.-]*:/iu
const AUTHORITY_RE = /^https:\/\/([^/?#]*)([/?#].*)?$/iu
const LABEL_RE = /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/u
const PORT_RE = /^[1-9]\d{0,4}$/u
const PATH_RE = /^(?:\/(?:[\w.~!$&'()*+,;=:@-]|%[\da-f]{2})*)*$/iu
const DOT_SEGMENT_RE = /\/(?:\.|%2e){1,2}(?=\/|$)/iu

/** WHATWG URL strips leading and trailing C0 controls and spaces, nothing else. */
function trimControlsAndSpaces(input: string): string {
  let start = 0
  let end = input.length
  while (start < end && input.charCodeAt(start) <= 0x20)
    start++
  while (end > start && input.charCodeAt(end - 1) <= 0x20)
    end--
  return input.slice(start, end)
}

export type PublicHttpsUrlResult
  = | { ok: true, href: string }
    | { ok: false, reason: 'not-absolute' | 'not-public-https' }

/**
 * Parse `input` as an absolute HTTPS page. `not-absolute` means it is not an
 * absolute URL at all; `not-public-https` covers other schemes, credentials,
 * queries, fragments, IP or internationalized hosts, and paths that a browser
 * would rewrite.
 */
export function parsePublicHttpsUrl(input: string): PublicHttpsUrlResult {
  const value = trimControlsAndSpaces(input)
  if (!SCHEME_RE.test(value))
    return { ok: false, reason: 'not-absolute' }
  const authority = AUTHORITY_RE.exec(value)
  if (!authority)
    return { ok: false, reason: 'not-public-https' }

  const [, hostPort, path = ''] = authority
  if (hostPort.includes('@') || path.includes('?') || path.includes('#') || path.includes('\\'))
    return { ok: false, reason: 'not-public-https' }

  const portIndex = hostPort.lastIndexOf(':')
  const host = (portIndex === -1 ? hostPort : hostPort.slice(0, portIndex)).toLowerCase()
  const port = portIndex === -1 ? '' : hostPort.slice(portIndex + 1)
  const labels = host.split('.')
  if (labels.length < 2
    || labels.some(label => !LABEL_RE.test(label) || label.startsWith('xn--'))
    || /^\d+$/u.test(labels.at(-1)!)) {
    return { ok: false, reason: 'not-public-https' }
  }
  if (port && (!PORT_RE.test(port) || Number(port) > 65535))
    return { ok: false, reason: 'not-public-https' }
  if (!PATH_RE.test(path) || DOT_SEGMENT_RE.test(path))
    return { ok: false, reason: 'not-public-https' }

  return { ok: true, href: `https://${host}${port && port !== '443' ? `:${port}` : ''}${path || '/'}` }
}
