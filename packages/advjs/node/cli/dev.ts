import type { LogLevel, ViteDevServer } from 'vite'
import type { Argv } from 'yargs'
import { exec } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import equal from 'fast-deep-equal'
import fs from 'fs-extra'
import { yellow } from 'kolorist'
import openBrowser from 'open'
import prompts from 'prompts'
import { resolveOptions } from '../options'
import { createServer } from '../server'
import { resolveThemeName } from '../themes'
import { commonOptions, CONFIG_RESTART_FIELDS, findFreePort, printInfo } from './utils'

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
    async ({ entry, theme, port: userPort, open, log, remote }) => {
      if (!fs.existsSync(entry) && !entry.endsWith('.adv.md'))
        entry = `${entry}.adv.md`

      if (!fs.existsSync(entry)) {
        const { create } = await prompts({
          name: 'create',
          type: 'confirm',
          initial: 'Y',
          message: `Entry file ${yellow(`"${entry}"`)} does not exist, do you want to create it?`,
        })
        if (create)
          await fs.copyFile(path.resolve(__dirname, '../template.adv.md'), entry)
        else
          process.exit(0)
      }

      let server: ViteDevServer | undefined
      let port = 3333

      async function initServer() {
        if (server)
          await server.close()
        const options = await resolveOptions({ entry, remote, theme }, 'dev')
        port = userPort || await findFreePort(port)
        server = (await createServer(
          options,
          {
            server: {
              port,
              strictPort: true,
              open,
              host: remote !== undefined ? '0.0.0.0' : 'localhost',
            },
            logLevel: log as LogLevel,
          },
          {
            onDataReload(newData, data) {
              if (!theme && resolveThemeName(newData.config.theme) !== resolveThemeName(data.config.theme)) {
                console.log(yellow('\n  restarting on theme change\n'))
                initServer()
              }
              else if (CONFIG_RESTART_FIELDS.some(i => !equal(newData.config[i], data.config[i]))) {
                console.log(yellow('\n  restarting on config change\n'))
                initServer()
              }
            },
          },
        ))

        await server.listen()
        printInfo(options, port, remote)
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
    },
  )
}
