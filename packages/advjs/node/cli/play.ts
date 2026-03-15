import type { Argv } from 'yargs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { AdvPlayEngine, formatAsText } from '@advjs/core'
import { consola } from 'consola'
import { colors } from 'consola/utils'

const CHOICE_RE = /^(?:choose\s+)?(\d+)$/

let engine: AdvPlayEngine | null = null

function getEngine(sessionDir?: string): AdvPlayEngine {
  if (!engine)
    engine = new AdvPlayEngine(sessionDir)
  return engine
}

function output(data: unknown, json: boolean) {
  if (json)
    console.log(JSON.stringify(data, null, 2))
  else if (data && typeof data === 'object' && 'type' in data)
    console.log(formatAsText(data as any))
}

/**
 * Interactive play mode - reads stdin for next/choose commands
 */
async function interactivePlay(scriptPath: string, sessionId?: string) {
  const absPath = resolve(process.cwd(), scriptPath)
  const content = await readFile(absPath, 'utf-8')
  const eng = getEngine()

  const result = await eng.loadScript(content, absPath, sessionId)
  if (result) {
    console.log()
    console.log(colors.dim('━'.repeat(50)))
    console.log(formatAsText(result))
    console.log(colors.dim('━'.repeat(50)))
  }

  if (eng.isEnd()) {
    consola.info('Story ended.')
    return
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const prompt = () => {
    const status = eng.getStatus()
    const hint = status.status === 'waiting_choice'
      ? colors.yellow('choose <number>')
      : colors.dim('enter/next')

    rl.question(`\n${colors.dim('>')} (${hint}): `, async (input) => {
      const trimmed = input.trim().toLowerCase()

      if (trimmed === 'quit' || trimmed === 'q' || trimmed === 'exit') {
        rl.close()
        return
      }

      if (trimmed === 'status') {
        console.log(JSON.stringify(eng.getStatus(), null, 2))
        prompt()
        return
      }

      if (trimmed === 'reset') {
        await eng.reset()
        consola.success('Session reset.')
        rl.close()
        return
      }

      let result
      const choiceMatch = CHOICE_RE.exec(trimmed)
      if (choiceMatch && status.status === 'waiting_choice') {
        result = await eng.choose(Number.parseInt(choiceMatch[1]))
      }
      else {
        result = await eng.next()
      }

      if (result) {
        console.log()
        console.log(colors.dim('━'.repeat(50)))
        console.log(formatAsText(result))
        console.log(colors.dim('━'.repeat(50)))
      }

      if (eng.isEnd()) {
        consola.info('Story ended.')
        rl.close()
        return
      }

      prompt()
    })
  }

  prompt()
}

export function installPlayCommand(cli: Argv) {
  cli.command('play [script]', 'Interactive narrative play', (yargs) => {
    return yargs
      .positional('script', {
        type: 'string',
        describe: 'Path to .adv.md script file',
      })
      .option('session-id', {
        type: 'string',
        describe: 'Session ID for persistence',
      })
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Output in JSON format',
      })
      .command('next', 'Advance to the next node', (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: 'Session ID' })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error('Session not found:', argv.sessionId)
          process.exit(1)
        }
        const next = await eng.next()
        output(next, argv.json as boolean)
      })
      .command('choose <number>', 'Make a choice', (yargs) => {
        return yargs
          .positional('number', { type: 'number', demandOption: true, describe: 'Choice number (1-based)' })
          .option('session-id', { type: 'string', demandOption: true, describe: 'Session ID' })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error('Session not found:', argv.sessionId)
          process.exit(1)
        }
        const choice = await eng.choose(argv.number as number)
        output(choice, argv.json as boolean)
      })
      .command('status', 'Show current session status', (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: 'Session ID' })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error('Session not found:', argv.sessionId)
          process.exit(1)
        }
        const status = eng.getStatus()
        if (argv.json)
          console.log(JSON.stringify(status, null, 2))
        else
          consola.info('Session status:', status)
      })
      .command('list', 'List all sessions', (yargs) => {
        return yargs
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const sessions = await eng.getSessionManager().list()
        if (argv.json) {
          console.log(JSON.stringify(sessions, null, 2))
        }
        else {
          if (sessions.length === 0) {
            consola.info('No active sessions.')
          }
          else {
            consola.info('Active sessions:')
            sessions.forEach(s => console.log(`  - ${s}`))
          }
        }
      })
      .command('reset', 'Reset a session', (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: 'Session ID' })
      }, async (argv) => {
        const eng = getEngine()
        await eng.getSessionManager().delete(argv.sessionId as string)
        consola.success('Session reset:', argv.sessionId)
      })
  }, async (argv) => {
    // Default: interactive play mode
    if (argv.script) {
      await interactivePlay(argv.script as string, argv.sessionId as string | undefined)
    }
    else {
      consola.error('Please provide a script file: adv play <script.adv.md>')
      process.exit(1)
    }
  })
}
