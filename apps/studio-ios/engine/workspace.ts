/**
 * Shared module resolution for the engine build and its Node tests. The
 * engine always compiles the current workspace sources, never stale `dist/`
 * builds, so Node and JavaScriptCore run the same code.
 */
import { resolve } from 'node:path'

export const engineRoot = import.meta.dirname
export const repoRoot = resolve(engineRoot, '../../..')
export const engineDist = resolve(engineRoot, 'dist')

/** Exact-match aliases from package specifiers to workspace source entries. */
export const engineAliases: Record<string, string> = {
  '@advjs/assets': 'packages/assets/src/index.ts',
  '@advjs/audio': 'packages/audio/src/index.ts',
  // Official plugins only need `defineAdvPlugin`; keep the UI barrel out.
  '@advjs/core': 'packages/core/src/runtime/headless.ts',
  '@advjs/core/compiler': 'packages/core/src/compiler/index.ts',
  '@advjs/core/project': 'packages/core/src/project/index.ts',
  '@advjs/parser': 'packages/parser/src/index.ts',
  '@advjs/plugin-interactions': 'plugins/plugin-interactions/src/index.ts',
  '@advjs/types': 'packages/types/src/index.ts',
}

export function resolveEngineAlias(specifier: string): string | undefined {
  const target = engineAliases[specifier]
  return target ? resolve(repoRoot, target) : undefined
}

/** Modules that must never enter the engine closure (esbuild filters use Go regexp syntax: no flags). */

export const FORBIDDEN_MODULE_RE = /^(?:node:|fs$|path$|url$|vue$|@vue\/|pixi|three|@babylonjs\/|monaco-editor|dexie|@capacitor\/)/

/**
 * Globals the bundle may reference outside a `typeof` guard: ECMAScript
 * builtins (implicit), Intl, and the Web APIs the host prelude provides.
 * Anything else (`URL`, `fetch`, timers, DOM) fails the build.
 */
export const ENGINE_ALLOWED_GLOBALS = [
  'AdvEngine',
  'atob',
  'btoa',
  'console',
  'crypto',
  'globalThis',
  'Intl',
  'structuredClone',
  'TextDecoder',
  'TextEncoder',
  '__advHost',
] as const

/**
 * Third-party references the engine never reaches, by module. Each entry is
 * also exercised by the golden tests, which run the bundle in a sandbox where
 * these globals do not exist.
 */
export const ENGINE_TOLERATED_GLOBAL_REFERENCES: ReadonlyArray<{ module: RegExp, names: readonly string[], reason: string }> = [
  {
    module: /\/zod\//u,
    names: ['File', 'URL', 'navigator'],
    reason: 'typeof-guarded feature probes and z.url()/z.file() validators that no engine schema uses',
  },
  {
    module: /\/vfile\/lib\/minurl\.browser\.js$/u,
    names: ['URL'],
    reason: 'converts URL objects to paths; the engine passes plain strings',
  },
]

/**
 * Upper bound for the minified engine; raise it only with a recorded reason.
 * 720 KiB at P1; 768 KiB from P2 for the shared project templates (~40 KiB of starter text).
 */
export const ENGINE_SIZE_BUDGET_BYTES = 768 * 1024
