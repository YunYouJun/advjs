import fs from 'fs'
import path from 'path'
import { parseAst } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

test('main', async () => {
  const advAst = await parseAst(testAdv)
  expect(advAst).toContain('仓鼠')
})
