import path from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

describe('@advjs/core browser bundle', () => {
  it('does not pull the Node-only storage driver into a Vite build', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        lib: {
          entry: path.resolve(import.meta.dirname, '../src/engine/runtime.ts'),
          formats: ['es'],
          name: 'AdvJsCoreBrowserTest',
        },
        minify: false,
        write: false,
      },
    })

    const outputs = Array.isArray(result) ? result : [result]
    const code = outputs.flatMap(output => output.output)
      .filter(item => item.type === 'chunk')
      .map(item => item.code)
      .join('\n')

    expect(code).toContain('AdvPlayEngine = class')
    expect(code).not.toContain('__vite-browser-external')
    expect(code).not.toContain('node:fs')
    expect(code).not.toContain('node:path')
  })
})
