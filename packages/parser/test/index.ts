import fs from 'node:fs'
import path from 'node:path'
import consola from 'consola'

import { parseAst } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

function main() {
  const advAst = parseAst(testAdv)
  consola.log(advAst)
}

main()
