#!/usr/bin/env node
'use strict'

const modulePath = '../dist/cli/index.js'

import(modulePath).catch((e) => {
  // eslint-disable-next-line no-console
  console.log(e)
})
