#!/usr/bin/env node
'use strict'

const modulePath = '../dist/node/cli/index.mjs'

import(modulePath).catch((e) => {
  // eslint-disable-next-line no-console
  console.log(e)
})
