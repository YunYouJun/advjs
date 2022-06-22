#!/usr/bin/env node
'use strict'

import path from 'path'
import resolveFrom from 'resolve-from'

let modulePath = '../dist/cli'
try {
  // use local cli if exists
  modulePath = path.join(path.dirname(resolveFrom(process.cwd(), 'advjs')), 'cli.mjs')
}
catch (e) {
  // eslint-disable-next-line no-console
  console.log(e)
}

import(modulePath)
