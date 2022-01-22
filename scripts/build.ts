import fs from 'fs'
import path from 'path'
import os from 'os'
import execa from 'execa'
import { logger } from './logger'

async function build(target: string) {
  const pkgDir = path.resolve(`packages/${target}`)

  fs.rmSync(`${pkgDir}/dist`, { recursive: true, force: true })

  try {
    await execa(
      'pnpm',
      [
        'run',
        `${target}:build`,
      ],
      { stdio: 'inherit' },
    )
    logger.success(`Build ${target} successfully.`)
  }
  catch (e) {
    logger.error(`Build ${target} error: ${e}`)
  }
}

async function runParallel(maxConcurrency: number, source: string[], iteratorFn: (item: string) => void) {
  const ret = []
  const executing = []
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item))
    ret.push(p)

    if (maxConcurrency <= source.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= maxConcurrency)
        await Promise.race(executing)
    }
  }
  return Promise.all(ret)
}

async function buildAll(targets: string[]) {
  await runParallel(os.cpus().length, targets, build)
}

async function run() {
  const targets = ['client', 'vrm', 'editor', 'docs']
  buildAll(targets)
}

run()
