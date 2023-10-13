import fs from 'node:fs'
import path from 'node:path'
import { expect } from 'vitest'
import { parseAst } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

it('main', async () => {
  const advAst = await parseAst(testAdv)
  expect(advAst.children).toContainEqual({
    type: 'text',
    value: '我：喂，你说世界上真的有外星人吗？',
  })
})
