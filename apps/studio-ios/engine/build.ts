/**
 * Bundle the engine into one classic script for JavaScriptCore.
 *
 * Usage: pnpm -C apps/studio-ios build:engine [--debug]
 * Output: engine/dist/engine.js, engine.meta.json, engine.report.json, and a
 * copy in Packages/StudioKit for the App and Swift tests.
 *
 * The build fails when the bundle imports Node, DOM or UI modules, references
 * globals JavaScriptCore lacks, or exceeds the size budget.
 */
import type { Metafile, Plugin } from 'esbuild'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { Linter } from 'eslint'
import {
  ENGINE_ALLOWED_GLOBALS,
  ENGINE_SIZE_BUDGET_BYTES,
  ENGINE_TOLERATED_GLOBAL_REFERENCES,
  engineDist,
  engineRoot,
  FORBIDDEN_MODULE_RE,
  resolveEngineAlias,
} from './workspace'

export interface EngineBuild {
  code: string
  metafile: Metafile
  bytes: number
  packages: Array<{ name: string, bytes: number }>
}

const workspaceSources: Plugin = {
  name: 'advjs-engine-workspace-sources',
  setup(context) {
    context.onResolve({ filter: /^@advjs\// }, (args) => {
      const path = resolveEngineAlias(args.path)
      if (!path)
        return { errors: [{ text: `No engine source mapping for ${args.path} (from ${args.importer})` }] }
      return { path }
    })
  },
}

const forbiddenModules: Plugin = {
  name: 'advjs-engine-forbidden-modules',
  setup(context) {
    context.onResolve({ filter: FORBIDDEN_MODULE_RE }, args => ({
      errors: [{ text: `Engine closure must not import ${args.path} (from ${args.importer})` }],
    }))
  },
}

function packageName(path: string): string {
  const match = path.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/u)
  if (match)
    return match[1]
  const workspace = path.match(/(?:^|\/)(packages|plugins|apps)\/([^/]+)\//u)
  return workspace ? `workspace:${workspace[2]}` : dirname(path)
}

export interface GlobalReference {
  name: string
  /** Bundled module the reference sits in, from esbuild's unminified path comments. */
  module: string
  line: number
}

/**
 * Free globals referenced outside `typeof` guards that JavaScriptCore lacks.
 * `code` must be an unminified build so references can be traced to modules.
 */
export function findForbiddenGlobals(code: string): GlobalReference[] {
  const lines = code.split('\n')
  const modules: string[] = []
  let current = ''
  for (const line of lines) {
    const match = /^\s*\/\/ (\S+\.(?:ts|js|mjs|cjs))$/u.exec(line)
    if (match)
      current = match[1]
    modules.push(current)
  }
  const linter = new Linter({ configType: 'flat' })
  const messages = linter.verify(code, {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: Object.fromEntries(ENGINE_ALLOWED_GLOBALS.map(name => [name, 'writable' as const])),
    },
    rules: { 'no-undef': ['error', { typeof: false }] },
  })
  const parseErrors = messages.filter(message => message.fatal)
  if (parseErrors.length > 0)
    throw new Error(`Engine bundle did not parse: ${parseErrors[0].message}`)
  return messages
    .filter(message => message.ruleId === 'no-undef')
    .map(message => ({
      name: /'([^']+)'/u.exec(message.message)?.[1] ?? message.message,
      module: modules[message.line - 1] ?? '',
      line: message.line,
    }))
    .filter(reference => !ENGINE_TOLERATED_GLOBAL_REFERENCES.some(entry => (
      entry.module.test(reference.module) && entry.names.includes(reference.name)
    )))
}

export async function buildEngine(options: { minify?: boolean } = {}): Promise<EngineBuild> {
  const minify = options.minify ?? true
  // Host shims must run before any module body, so they ship as a banner rather than an import.
  const prelude = await build({
    entryPoints: [resolve(engineRoot, 'src/host-prelude.ts')],
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    target: 'es2022',
    minify,
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  })
  const result = await build({
    banner: { js: prelude.outputFiles[0].text },
    entryPoints: [resolve(engineRoot, 'src/index.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'AdvEngine',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import', 'default'],
    target: 'es2022',
    minify,
    legalComments: 'none',
    metafile: true,
    write: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.DEV': 'false',
    },
    plugins: [forbiddenModules, workspaceSources],
    logLevel: 'warning',
  })

  const code = result.outputFiles[0].text
  const output = Object.values(result.metafile.outputs)[0]
  const packages = new Map<string, number>()
  for (const [path, info] of Object.entries(output.inputs))
    packages.set(packageName(path), (packages.get(packageName(path)) ?? 0) + info.bytesInOutput)

  return {
    code,
    metafile: result.metafile,
    bytes: Buffer.byteLength(code),
    packages: [...packages].map(([name, bytes]) => ({ name, bytes })).sort((left, right) => right.bytes - left.bytes),
  }
}

async function main() {
  const debug = process.argv.includes('--debug')
  const started = performance.now()
  // Check the unminified build: same tree shaking, but references stay traceable to modules.
  const forbidden = findForbiddenGlobals((await buildEngine({ minify: false })).code)
  if (forbidden.length > 0) {
    const list = forbidden.map(reference => `${reference.name} (${reference.module})`).join(', ')
    throw new Error(`Engine bundle references globals JavaScriptCore lacks: ${list}`)
  }
  const engine = await buildEngine({ minify: !debug })
  if (!debug && engine.bytes > ENGINE_SIZE_BUDGET_BYTES)
    throw new Error(`Engine bundle is ${engine.bytes} bytes, over the ${ENGINE_SIZE_BUDGET_BYTES} byte budget`)

  const report = {
    minified: !debug,
    bytes: engine.bytes,
    budgetBytes: ENGINE_SIZE_BUDGET_BYTES,
    packages: engine.packages,
  }
  await mkdir(engineDist, { recursive: true })
  await writeFile(resolve(engineDist, 'engine.js'), engine.code)
  await writeFile(resolve(engineDist, 'engine.meta.json'), JSON.stringify(engine.metafile))
  await writeFile(resolve(engineDist, 'engine.report.json'), `${JSON.stringify(report, null, 2)}\n`)

  const resources = resolve(engineRoot, '../Packages/StudioKit/Sources/StudioKit/EngineBundle')
  await mkdir(resources, { recursive: true })
  await writeFile(resolve(resources, 'engine.js'), engine.code)

  const lines = [
    `engine.js: ${(engine.bytes / 1024).toFixed(1)} KiB (${debug ? 'debug' : 'minified'}, budget ${(ENGINE_SIZE_BUDGET_BYTES / 1024).toFixed(0)} KiB) in ${(performance.now() - started).toFixed(0)} ms`,
    ...engine.packages.slice(0, 12).map(item => `  ${(item.bytes / 1024).toFixed(1).padStart(8)} KiB  ${item.name}`),
  ]
  process.stdout.write(`${lines.join('\n')}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
