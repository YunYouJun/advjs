import process from 'node:process'
import { advBuild } from 'advjs'

async function run() {
  try {
    const result = await advBuild({ userRoot: process.cwd(), base: './', outDir: process.argv[2]!, vite: { define: { 'import.meta.env.ADVJS_OFFLINE': true }, build: { assetsInlineLimit: 0 } } })
    process.parentPort!.postMessage({ type: 'result', result })
  }
  catch (error) {
    process.parentPort!.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
void run()
