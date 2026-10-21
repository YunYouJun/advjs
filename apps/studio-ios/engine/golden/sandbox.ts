import type { EngineCall } from './cases'
import { randomBytes } from 'node:crypto'
import vm from 'node:vm'

/**
 * Evaluate the bundled engine in a fresh V8 context that, like
 * JavaScriptCore, has only ECMAScript and Intl: no console, TextEncoder,
 * crypto, URL, fetch, timers or DOM. The host injects randomness only.
 */
export function loadEngineSandbox(code: string): { call: EngineCall, globals: string[] } {
  const host = { randomBytes: (length: number) => Array.from(randomBytes(length)) }
  const context = vm.createContext({ __advHost: host })
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', context) as string[])
  vm.runInContext(code, context, { filename: 'engine.js' })
  const added = (vm.runInContext('Object.getOwnPropertyNames(globalThis)', context) as string[])
    .filter(name => !before.has(name))
    .sort()
  const engine = context.AdvEngine as { call: EngineCall } | undefined
  if (!engine || typeof engine.call !== 'function')
    throw new Error('AdvEngine.call is missing from the bundle')
  return { call: (operation, input) => engine.call(operation, input), globals: added }
}
