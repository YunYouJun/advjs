interface Permit { active: number, waiters: Array<() => void> }
const permits = new Map<string, Permit>()

/** Editor jobs, single-line synthesis and design previews share local resources. */
export async function withVoiceProviderPermit<T>(providerId: string, limit: number, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  signal.throwIfAborted()
  const permit = permits.get(providerId) ?? { active: 0, waiters: [] }
  permits.set(providerId, permit)
  await new Promise<void>((resolve, reject) => {
    function enter() {
      signal.removeEventListener('abort', abort)
      permit.active++
      resolve()
    }
    function abort() {
      const index = permit.waiters.indexOf(enter)
      if (index >= 0)
        permit.waiters.splice(index, 1)
      reject(signal.reason ?? new Error('Aborted'))
    }
    if (permit.active < limit) {
      enter()
    }
    else {
      permit.waiters.push(enter)
      signal.addEventListener('abort', abort, { once: true })
    }
  })
  try {
    signal.throwIfAborted()
    return await operation()
  }
  finally {
    permit.active--
    permit.waiters.shift()?.()
    if (!permit.active && !permit.waiters.length)
      permits.delete(providerId)
  }
}
