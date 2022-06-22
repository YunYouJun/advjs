import fs from 'fs'
import path from 'path'
import consola from 'consola'

import { parseAst } from '../src'

const testAdv = fs.readFileSync(path.resolve(__dirname, '../../shared/examples/test.adv'), 'utf-8')

function main() {
  const advAst = parseAst(testAdv)
  consola.log(advAst)
}

main()
