import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const runtimeRoot = process.argv.find(value => value.startsWith('--runtime='))?.slice('--runtime='.length)
if (!runtimeRoot)
  throw new Error('Pass --runtime=/absolute/path/to/YunLeFun/api for the local browser integration fixture')
const api = resolve(runtimeRoot)
const root = fileURLToPath(new URL('..', import.meta.url))
const temporary = await mkdtemp(join(tmpdir(), 'advjs-runtime-browser-'))
try {
  const config = join(temporary, 'tsconfig.json')
  await writeFile(config, JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', paths: {
    '@yunlefun/ai-runtime': [join(api, 'packages/ai-runtime/src/index.ts')],
    '@yunlefun/ai-runtime/testing': [join(api, 'packages/ai-runtime/src/testing.ts')],
    '@yunlefun/ai-runtime-contracts': [join(api, 'packages/ai-runtime-contracts/src/index.ts')],
    '@yunlefun/ai-runtime-advjs': [join(api, 'packages/ai-runtime-advjs/src/index.ts')],
  } } }))
  const child = spawn(process.execPath, [createRequire(import.meta.url).resolve('tsx/cli'), '--tsconfig', config, join(api, 'packages/ai-runtime-advjs/test/studio-browser-server.ts'), `--model=${join(root, 'apps/studio/tests/fixtures/creative-team/production-start-output.ts')}`], { stdio: 'inherit', env: { ...process.env, ADVJS_LOCAL_RUNTIME_FIXTURE: '1' } })
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => child.kill(signal))
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
  process.exitCode = code
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
