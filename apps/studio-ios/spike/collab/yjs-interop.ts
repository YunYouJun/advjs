/* eslint-disable no-console, antfu/no-top-level-await -- SPIKE CLI script: top-level steps report to stdout. */
/**
 * SPIKE: can the Web Studio's Yjs documents be edited inside JavaScriptCore?
 *
 * Node (V8) and the macOS `jsc` shell exchange binary Yjs updates for the same
 * Y.Text and must converge. Usage:
 *   pnpm exec tsx apps/studio-ios/spike/collab/yjs-interop.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { build } from 'esbuild'
import * as Y from 'yjs'

const here = import.meta.dirname
const out = resolve(here, '../out/collab')
mkdirSync(out, { recursive: true })

// The probe bundles the same `yjs` version Studio resolves.
const studioYjs = resolve(here, '../../../studio/node_modules/yjs')
await build({
  stdin: {
    contents: `
      import * as Y from ${JSON.stringify(studioYjs)}
      globalThis.YProbe = {
        apply(updateBytes, edit) {
          const doc = new Y.Doc()
          Y.applyUpdate(doc, Uint8Array.from(updateBytes))
          const text = doc.getText('adv/chapters/start.adv.md')
          const before = Y.encodeStateVector(doc)
          text.insert(text.length, edit)
          text.delete(0, 1)
          const delta = Y.encodeStateAsUpdate(doc, before)
          return JSON.stringify({ text: text.toString(), update: Array.from(delta), clientID: doc.clientID })
        },
      }
    `,
    resolveDir: here,
  },
  // JavaScriptCore has no Web Crypto; lib0 needs randomness for client IDs. The
  // native host supplies SecRandomCopyBytes (see the engine prelude); the shell
  // probe uses Math.random because only convergence is under test here.
  banner: { js: 'globalThis.crypto ??= { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a } };' },
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2022',
  outfile: resolve(out, 'yjs-probe.js'),
  logLevel: 'warning',
})

const node = new Y.Doc()
const text = node.getText('adv/chapters/start.adv.md')
text.insert(0, '【房间】\n\n@小云\n你好。🐹')
const update = Array.from(Y.encodeStateAsUpdate(node))
writeFileSync(resolve(out, 'yjs-input.js'), `const result = YProbe.apply(${JSON.stringify(update)}, '\\n——来自 JavaScriptCore')\nprint(result)\n`)

const jsc = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
const result = JSON.parse(execFileSync(jsc, [resolve(out, 'yjs-probe.js'), resolve(out, 'yjs-input.js')], { encoding: 'utf8' }))
Y.applyUpdate(node, Uint8Array.from(result.update))
const converged = text.toString() === result.text
console.log(JSON.stringify({ converged, node: text.toString(), jsc: result.text, jscClientID: result.clientID }, null, 2))
if (!converged)
  process.exitCode = 1
