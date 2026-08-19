import { appendFile, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

async function main() {
  const scenarioPath = process.env.ADV_FAKE_WRANGLER_SCENARIO
  const logPath = process.env.ADV_FAKE_WRANGLER_LOG

  if (!scenarioPath || !logPath)
    throw new Error('Fake Wrangler requires scenario and log paths')

  const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'))
  const args = process.argv.slice(2)
  await appendFile(logPath, `${JSON.stringify({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? null,
    args,
  })}\n`)

  const command = args.join(' ')
  if (scenario.failure && command.includes(scenario.failure.command)) {
    process.stderr.write(`${scenario.failure.message}\n`)
    process.exit(1)
  }

  if (args[0] === 'whoami' && scenario.authFailuresRemaining > 0) {
    scenario.authFailuresRemaining -= 1
    await writeFile(scenarioPath, JSON.stringify(scenario), 'utf8')
    process.stderr.write('Not authenticated. Please login.\n')
    process.exit(1)
  }
  else if (args[0] === 'whoami') {
    process.stdout.write(`${JSON.stringify({ accounts: scenario.accounts ?? [] })}\n`)
  }
  else if (args[0] === 'login') {
    process.stdout.write('Login complete\n')
  }
  else if (command.startsWith('pages project list')) {
    process.stdout.write(`${JSON.stringify(scenario.projects ?? [])}\n`)
  }
  else if (command.startsWith('pages project create')) {
    process.stdout.write(`Created project ${args[3]}\n`)
  }
  else if (command.startsWith('pages deployment list')) {
    process.stdout.write(`${JSON.stringify(scenario.deployments ?? [])}\n`)
  }
  else if (command.startsWith('pages deploy')) {
    process.stdout.write('Deployment complete\n')
  }
  else if (args[0] === 'deploy') {
    process.stdout.write('Worker deployment complete\n')
  }
  else if (command.startsWith('deployments list')) {
    process.stdout.write(`${JSON.stringify(scenario.workerDeployments ?? [])}\n`)
  }
  else {
    process.stderr.write(`Unexpected fake Wrangler command: ${command}\n`)
    process.exit(2)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
