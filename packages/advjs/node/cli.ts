import path from 'path'
import net from 'net'
import os from 'os'
import { exec } from 'child_process'
import * as readline from 'readline'
import fs from 'fs-extra'
import openBrowser from 'open'
import type { Argv } from 'yargs'
import yargs from 'yargs'
import prompts from 'prompts'
import { blue, bold, cyan, dim, gray, green, underline, yellow } from 'kolorist'
import type { LogLevel, ViteDevServer } from 'vite'
import isInstalledGlobally from 'is-installed-globally'
import equal from 'fast-deep-equal'
import type { AdvConfig } from '@advjs/types'
import { version } from '../package.json'
import { createServer } from './server'
import type { ResolvedAdvOptions } from './options'
import { resolveOptions } from './options'
import { resolveThemeName } from './themes'
// import { parser } from './parser'

const CONFIG_RESTART_FIELDS: (keyof AdvConfig)[] = [
  // null
]

const namespace = 'adv'
const cli = yargs
  .scriptName(namespace)
  .usage('$0 [args]')
  .version(version)
  .strict()
  .showHelpOnFail(false)
  .alias('h', 'help')
  .alias('v', 'version')

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
      type: 'string',
      describe: 'listen public host and enable remote control',
    })
    .option('log', {
      default: 'warn',
      type: 'string',
      choices: ['error', 'warn', 'info', 'silent'],
      describe: 'log level',
    })
    .option('force', {
      alias: 'f',
      default: false,
      type: 'boolean',
      describe: 'force the optimizer to ignore the cache and re-bundle  ',
    })
    .strict()
    .help(),
  async ({ entry, theme, port: userPort, open, log, remote, force }) => {
    if (!fs.existsSync(entry) && !entry.endsWith('.md'))
      entry = `${entry}.md`

    if (!fs.existsSync(entry)) {
      const { create } = await prompts({
        name: 'create',
        type: 'confirm',
        initial: 'Y',
        message: `Entry file ${yellow(`"${entry}"`)} does not exist, do you want to create it?`,
      })
      if (create)
        await fs.copyFile(path.resolve(__dirname, '../template.md'), entry)
      else
        process.exit(0)
    }

    let server: ViteDevServer | undefined
    let port = 3030

    async function initServer() {
      if (server)
        await server.close()
      const options = await resolveOptions({ entry, remote, theme }, 'dev')
      port = userPort || await findFreePort(3030)
      server = (await createServer(
        options,
        {
          server: {
            port,
            strictPort: true,
            open,
            host: remote !== undefined ? '0.0.0.0' : 'localhost',
            force,
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
        process.stdin.setRawMode(true)

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

cli.command(
  'build [entry]',
  'Build hostable SPA',
  args => commonOptions(args)
    .option('watch', {
      alias: 'w',
      default: false,
      describe: 'build watch',
    })
    .option('out', {
      alias: 'o',
      type: 'string',
      default: 'dist',
      describe: 'output dir',
    })
    .option('base', {
      type: 'string',
      describe: 'output base',
    })
    .option('download', {
      alias: 'd',
      type: 'boolean',
      describe: 'allow download as PDF',
    })
    .strict()
    .help(),
  async ({ entry, theme, watch, base, download, out }) => {
    const { build } = await import('./build')

    const options = await resolveOptions({ entry, theme }, 'build')
    if (download && !options.data.config.download)
      options.data.config.download = download

    printInfo(options)
    await build(options, {
      base,
      build: {
        watch: watch ? {} : undefined,
        outDir: out,
      },
    })
  },
)

cli
  .help()
  .parse()

function commonOptions(args: Argv<{}>) {
  return args
    .positional('entry', {
      default: 'index.adv.md',
      type: 'string',
      describe: 'path to the advjs markdown entry',
    })
    .option('theme', {
      alias: 't',
      type: 'string',
      describe: 'override theme',
    })
}

function printInfo(options: ResolvedAdvOptions, port?: number, remote?: string) {
  console.log()
  console.log()
  console.log(`  ${cyan('●') + blue('■') + yellow('▲')}`)
  console.log(`${bold('  ADV.JS')}  ${blue(`v${version}`)} ${isInstalledGlobally ? yellow('(global)') : ''}`)
  console.log()
  console.log(dim('  theme   ') + (options.theme ? green(options.theme) : gray('none')))
  console.log(dim('  entry   ') + dim(path.dirname(options.entry) + path.sep) + path.basename(options.entry))
  if (port) {
    const query = remote ? `?password=${remote}` : ''
    const presenterPath = `${options.data.config.routerMode === 'hash' ? '/#/' : '/'}presenter/${query}`
    console.log()
    console.log(`${dim('  public slide show ')}  > ${cyan(`http://localhost:${bold(port)}/`)}`)
    if (query)
      console.log(`${dim('  private slide show ')} > ${cyan(`http://localhost:${bold(port)}/${query}`)}`)
    console.log(`${dim('  presenter mode ')}     > ${blue(`http://localhost:${bold(port)}${presenterPath}`)}`)

    if (remote !== undefined) {
      Object.values(os.networkInterfaces())
        .forEach(v => (v || [])
          .filter(details => String(details.family).slice(-1) === '4' && !details.address.includes('127.0.0.1'))
          .forEach(({ address }) => {
            console.log(`${dim('  remote control ')}     > ${blue(`http://${address}:${port}${presenterPath}`)}`)
          }),
        )
    }
    else {
      console.log(`${dim('  remote control ')}     > ${dim('pass --remote to enable')}`)
    }

    console.log()
    console.log(`${dim('  shortcuts ')}          > ${underline('r')}${dim('estart | ')}${underline('o')}${dim('pen | ')}${underline('e')}${dim('dit')}`)
  }
  console.log()
  console.log()
}

function isPortFree(port: number) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.write('Echo server\r\n')
      socket.pipe(socket)
    })

    server.listen(port, '127.0.0.1')
    server.on('error', () => {
      resolve(false)
    })
    server.on('listening', () => {
      server.close()
      resolve(true)
    })
  })
}

async function findFreePort(start: number): Promise<number> {
  if (await isPortFree(start))
    return start
  return findFreePort(start + 1)
}