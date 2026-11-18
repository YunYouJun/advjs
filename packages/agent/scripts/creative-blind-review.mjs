import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Development-only source entry: pending paid artifacts must not require rebuilding workspace dist.
const child = spawn(process.execPath, [createRequire(import.meta.url).resolve('tsx/cli'), fileURLToPath(new URL('./creative-blind-review.ts', import.meta.url)), ...process.argv.slice(2)], { stdio: 'inherit' })
process.exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', code => resolve(code ?? 1))
})
