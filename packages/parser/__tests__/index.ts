
import fs from 'fs'
import path from 'path'
import { parse } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

test('main', async() => {
  const advAst = await parse(testAdv)
  expect(advAst).toContain('仓鼠')
})
