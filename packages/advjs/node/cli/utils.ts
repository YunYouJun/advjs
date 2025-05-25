import type { Argv } from 'yargs'
import type { ResolvedAdvOptions } from '../options'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { colors } from 'consola/utils'
import { version } from '../../package.json'
import { isInstalledGlobally } from '../resolver'

export function isPortFree(port: number) {
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

export async function findFreePort(start: number): Promise<number> {
  if (await isPortFree(start))
    return start
  return findFreePort(start + 1)
}

export function commonOptions(args: Argv) {
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

/**
 * print info for advjs
 * @param options
 * @param port
 * @param remote
 */
export function printInfo(options: ResolvedAdvOptions, port?: number, remote?: boolean) {
  const { data: { config, gameConfig } } = options
  const themeVersion = colors.blue(`v${options.data.themeConfig?.pkg?.version}`) || 'unknown'

  console.log()
  console.log()
  console.log(`${colors.bold('  🎮 ADV.JS')}  ${colors.blue(`v${version}`)} ${isInstalledGlobally.value ? colors.yellow('(global)') : ''}`)
  console.log()
  if (gameConfig.title)
    console.log(colors.dim('  ⚔️  Game      ') + colors.yellow(gameConfig.title))

  console.log(`  ${colors.dim('🗺️  Theme')}     > ${colors.green(config.theme)} (${themeVersion})`)
  if (config.format === 'fountain')
    console.log(colors.dim('  📃 Entry     ') + colors.dim(path.dirname(options.entry) + path.sep) + path.basename(options.entry))
  else
    console.log(`  ${colors.dim('📁')} ${colors.dim(colors.underline(options.userRoot))}`)

  if (port) {
    console.log()
    console.log(`${colors.dim('  Preview    ')}  > ${colors.cyan(`http://localhost:${colors.bold(port)}/`)}`)

    if (remote) {
      Object.values(os.networkInterfaces())
        .forEach(v => (v || [])
          .filter(details => details.family === 'IPv4' && !details.address.includes('127.0.0.1'))
          .forEach(({ address }) => {
            console.log(`${colors.dim('  Network     ')} > ${colors.blue(`http://${address}:${colors.bold(port)}/`)}`)
          }),
        )
    }

    console.log()
    console.log(`${colors.dim('  shortcuts ')}   > ${colors.underline('r')}${colors.dim('estart | ')}${colors.underline('o')}${colors.dim('pen | ')}${colors.underline('e')}${colors.dim('dit')}`)
  }
  console.log()
  console.log()
}
