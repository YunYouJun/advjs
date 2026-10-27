import {
  defaultFrontmatterValue,
  formatBodyRaw,
  isSameContentValue,
  mergeManagedFrontmatter,
  readFrontmatterSource,
  writeFrontmatterSource,
} from './frontmatter'

export interface FrontmatterDocumentSpec<T extends object> {
  /** Frontmatter keys owned by the serializer, in canonical write order. */
  keys: readonly string[]
  parse: (content: string) => T
  /** Field that falls back to the body text when absent from frontmatter. */
  bodyField?: keyof T & string
  toFrontmatter?: (key: string, value: unknown) => unknown
}

/**
 * Update a frontmatter-only document in place.
 *
 * Returns `undefined` when `source` cannot serve as a base (no frontmatter or
 * not parseable as this content type); callers then write a fresh document.
 */
export function updateFrontmatterDocument<T extends object>(
  spec: FrontmatterDocumentSpec<T>,
  source: string,
  next: T,
): string | undefined {
  const document = readFrontmatterSource(source)
  if (!document)
    return undefined
  let baseline: Record<string, any>
  try {
    baseline = spec.parse(source) as Record<string, any>
  }
  catch {
    return undefined
  }

  const nextValues = next as Record<string, any>
  const bodyField = spec.bodyField
  const bodyHoldsField = Boolean(bodyField && !document.data[bodyField] && document.body)
  const keys = bodyHoldsField ? spec.keys.filter(key => key !== bodyField) : spec.keys
  const { data, changed } = mergeManagedFrontmatter(
    document.data,
    baseline,
    nextValues,
    keys,
    spec.toFrontmatter ?? defaultFrontmatterValue,
  )

  let bodyRaw = document.bodyRaw
  let bodyChanged = false
  if (bodyHoldsField && !isSameContentValue(baseline[bodyField!], nextValues[bodyField!])) {
    const value = nextValues[bodyField!]
    bodyRaw = formatBodyRaw(typeof value === 'string' ? value : '')
    bodyChanged = true
  }

  if (!changed && !bodyChanged)
    return source
  return writeFrontmatterSource(data, bodyRaw)
}
