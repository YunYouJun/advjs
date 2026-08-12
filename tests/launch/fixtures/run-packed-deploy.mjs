import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

async function main() {
  const [modulePath, projectRoot] = process.argv.slice(2)

  if (!modulePath || !projectRoot)
    throw new TypeError('Usage: run-packed-deploy.mjs <advjs-module> <project-root>')

  const { deployProject } = await import(pathToFileURL(modulePath).href)
  const result = await deployProject({
    project: 'rain-letter',
    provider: {
      name: 'cloudflare-pages',
      async deploy(input) {
        if (input.previousConfig !== undefined)
          throw new Error('First packed deployment unexpectedly received previous configuration')
        return {
          deploymentId: 'launch-deployment',
          projectId: 'rain-letter',
          url: 'https://rain-letter.pages.dev/',
        }
      },
    },
    root: projectRoot,
    verifyDeployment: async () => {},
  })

  const receipt = await readFile(result.receipt, 'utf8')
  if (!receipt.includes('launch-deployment'))
    throw new Error('Packed deployment receipt is missing the deployment ID')

  process.stdout.write(`${JSON.stringify(result)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
})
