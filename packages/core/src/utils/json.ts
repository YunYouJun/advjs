/**
 * Clone values at runtime boundaries while removing framework proxies.
 * Runtime contracts only accept JSON-compatible data.
 */
export function cloneJsonData<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined)
    throw new TypeError('Runtime data must be JSON-compatible')
  return JSON.parse(serialized) as T
}
