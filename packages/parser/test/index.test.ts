import path from 'node:path'
import fs from 'fs-extra'
import { expect, it } from 'vitest'
import { parseAst } from '../src'

const testAdvPath = path.resolve(import.meta.dirname, '../../shared/examples/test.adv')

it('main', async () => {
  const testAdv = await fs.readFile(testAdvPath, 'utf-8')
  const advAst = await parseAst(testAdv)
  expect(advAst.children).toContainEqual({
    type: 'text',
    value: '我：喂，你说世界上真的有外星人吗？',
  })
})
