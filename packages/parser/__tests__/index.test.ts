import fs from 'fs'
import path from 'path'
import { expect, test } from 'vitest'
import { parseAst } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

test('main', async () => {
  const advAst = await parseAst(testAdv)
  expect(advAst.children).toContainEqual({
    type: 'text',
    value: '我：喂，你说世界上真的有外星人吗？',
  })
})
