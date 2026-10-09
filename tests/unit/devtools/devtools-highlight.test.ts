// @vitest-environment node
import { tmpdir } from 'node:os'
import process from 'node:process'
import { createHostContext } from 'devframe/node'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { createAdvDevToolsDevframe } from '../../../packages/devtools/src/devframe'
import { MAX_JSON_HIGHLIGHT_LENGTH } from '../../../packages/shared/json-highlight'

describe('devTools Shiki service', () => {
  it('installs the shared service and exposes exact JSON tokens through its scoped RPC', async () => {
    const context = await createHostContext({
      cwd: process.cwd(),
      mode: 'dev',
      host: {
        resolveOrigin: () => 'http://localhost',
        getStorageDir: scope => join(tmpdir(), 'advjs-devtools-test', scope),
        mountStatic: () => { throw new Error('This test does not mount static files') },
      },
    })
    const frame = createAdvDevToolsDevframe()
    for (const service of frame.services ?? [])
      void context.services.install(service)
    await context.services.ready()
    await frame.setup?.(context)
    const rpc = context.scope('advjs-devtools').rpc
    const code = '{\r\n  "name": "<img src=x onerror=alert(1)>",\r\n  "count": -1.2e3,\r\n  "flags": [true, false, null],\r\n  "quoted\\\"key": "escaped\\nline"\r\n}\r\n'
    const tokens = await rpc.call('highlight-json', code)
    expect(tokens?.map(token => token.content).join('')).toBe(code)
    const color = (content: string) => tokens?.find(token => token.content.includes(content))?.color
    expect(color('name')).toBe('var(--agui-c-syntax-key)')
    expect(color('<img src=x onerror=alert(1)>')).toBe('var(--agui-c-syntax-string)')
    expect(color('-1.2e3')).toBe('var(--agui-c-syntax-number)')
    for (const value of ['true', 'false', 'null'])
      expect(color(value)).toBe('var(--agui-c-syntax-literal)')
    for (const value of ['false', '0', 'null', '"text"', '[]'])
      expect((await rpc.call('highlight-json', value))?.map(token => token.content).join('')).toBe(value)
    for (const value of ['', 'Error: failed', '{"broken":}', JSON.stringify('x'.repeat(MAX_JSON_HIGHLIGHT_LENGTH))])
      expect(await rpc.call('highlight-json', value)).toBeUndefined()
  })
})
