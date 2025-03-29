import type { LogLevel, ViteDevServer } from 'vite'
import type { Argv } from 'yargs'
import { exec } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { colors } from 'consola/utils'
import fs from 'fs-extra'
import openBrowser from 'open'
import prompts from 'prompts'
import { createServer } from '../commands/serve'
import { loadAdvConfig } from '../config'
import { loadAdvGameConfig } from '../config/game'
import { loadAdvThemeConfig } from '../config/theme'
import { resolveOptions } from '../options'
import { commonOptions, findFreePort, printInfo } from './utils'

/**
 * 检查剧本文件是否存在
 */
export async function checkFountain(entry: string) {
  if (!fs.existsSync(entry) && !entry.endsWith('.adv.md'))
    entry = `${entry}.adv.md`

  if (!fs.existsSync(entry)) {
    const { create } = await prompts({
      name: 'create',
      type: 'confirm',
      initial: 'Y',
      message: `Entry file ${colors.yellow(`"${entry}"`)} does not exist, do you want to create it?`,
    })
    if (create)
      await fs.copyFile(path.resolve(__dirname, '../template.adv.md'), entry)
    else
      process.exit(0)
  }
}

/**
 * Start a local server for ADV.JS
 */
export async function advDev(options: {
  root: string
  port?: number
  remote?: boolean
  log?: LogLevel
  open?: boolean
  entry?: string
} = {
  root: process.cwd(),
}) {
  const { port: userPort, remote, log, open, entry = 'index' } = options

  let server: ViteDevServer | undefined
  let port = 3333

  async function initServer() {
    if (server)
      await server.close()
    const resolvedOptions = await resolveOptions({
      entry,
      remote,
    }, 'dev')

    const { data, userRoot, themeRoot, tempRoot } = resolvedOptions
    if (data.config.format === 'fountain') {
      await checkFountain(entry)
    }

    port = userPort || await findFreePort(port)
    server = (await createServer(
      resolvedOptions,
      {
        server: {
          watch: {
            ignored: [
              tempRoot,
              `!${userRoot}/**`,
              `!${themeRoot}/**`,
            ],
          },

          port,
          strictPort: true,
          open,
          host: remote !== undefined ? '0.0.0.0' : 'localhost',
        },
        logLevel: log as LogLevel,
      },
      {
        async loadData(_ctx, loadedSource) {
          const file = Object.keys(loadedSource)[0]

          // console.log('file', file, ctx.server.moduleGraph.getModulesByFile(file))
          // console.log('file id', file, ctx.server.moduleGraph.getModuleById(file))

          if (file.endsWith('adv.config.ts')) {
            const { config } = await loadAdvConfig()
            return {
              ...data,
              config,
            }
          }
          else if (file.endsWith('game.config.ts')) {
            const { gameConfig } = await loadAdvGameConfig()
            return {
              ...data,
              gameConfig,
            }
          }
          else if (file.endsWith('theme.config.ts')) {
            const { themeConfig } = await loadAdvThemeConfig(options)
            return {
              ...data,
              themeConfig,
            }
          }
          return false
        },
      },
    ))

    await server.listen()
    printInfo(resolvedOptions, port, remote)
  }

  const SHORTCUTS = [
    {
      name: 'r',
      fullname: 'restart',
      action() {
        initServer()
      },
    },
    {
      name: 'o',
      fullname: 'open',
      action() {
        openBrowser(`http://localhost:${port}`)
      },
    },
    {
      name: 'e',
      fullname: 'edit',
      action() {
        exec(`code "${entry}"`)
      },
    },
  ]

  function bindShortcut() {
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY)
      process.stdin.setRawMode?.(true)

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        process.exit()
      }
      else {
        const [sh] = SHORTCUTS.filter(item => item.name === str)
        if (sh) {
          try {
            sh.action()
          }
          catch (err) {
            console.error(`Failed to execute shortcut ${sh.fullname}`, err)
          }
        }
      }
    })
  }

  initServer()
  bindShortcut()
}

export async function installDevCommand(cli: Argv) {
  cli.command(
    '* [entry]',
    'Start a local server for ADV.JS',
    args => commonOptions(args)
      .option('port', {
        alias: 'p',
        type: 'number',
        describe: 'port',
      })
      .option('open', {
        alias: 'o',
        default: false,
        type: 'boolean',
        describe: 'open in browser',
      })
      .option('remote', {
        default: true,
        type: 'boolean',
        describe: 'listen public host and enable remote control',
      })
      .option('log', {
        default: 'warn',
        type: 'string',
        choices: ['error', 'warn', 'info', 'silent'],
        describe: 'log level',
      })
      .strict()
      .help(),
    async ({ entry, port: userPort, open, log, remote }) => {
      advDev({
        root: process.cwd(),
        entry,
        port: userPort,
        open,
        log: log as LogLevel,
        remote,
      })
    },
  )
}
