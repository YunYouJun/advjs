#!/usr/bin/env node
'use strict'

const path = require('node:path')
const resolveFrom = require('resolve-from')

let modulePath = '../dist/cli'
try {
  // use local cli if exists
  modulePath = path.join(path.dirname(resolveFrom(process.cwd(), 'advjs')), 'cli.js')
}
catch (e) {
  // eslint-disable-next-line no-console
  console.log(e)
}

require(modulePath)
