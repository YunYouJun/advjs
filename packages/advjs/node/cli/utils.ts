import type { AdvConfig } from '@advjs/types'
import type { Argv } from 'yargs'
import type { ResolvedAdvOptions } from '../options'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import isInstalledGlobally from 'is-installed-globally'
import { blue, bold, cyan, dim, gray, green, underline, yellow } from 'kolorist'
import { version } from '../../package.json'

export const CONFIG_RESTART_FIELDS: (keyof AdvConfig)[] = [
  // null
]

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
  console.log()
  console.log()
  console.log(`${bold('  🎮 ADV.JS')}  ${blue(`v${version}`)} ${isInstalledGlobally ? yellow('(global)') : ''}`)
  console.log()
  if (options.config.title)
    console.log(dim('  Game         ') + yellow(options.config.title))
  console.log(dim('  theme        ') + (options.theme ? green(options.theme) : gray('none')))
  console.log(dim('  entry        ') + dim(path.dirname(options.entry) + path.sep) + path.basename(options.entry))
  if (port) {
    console.log()
    console.log(`${dim('  Preview    ')}  > ${cyan(`http://localhost:${bold(port)}/`)}`)

    if (remote) {
      Object.values(os.networkInterfaces())
        .forEach(v => (v || [])
          .filter(details => details.family === 'IPv4' && !details.address.includes('127.0.0.1'))
          .forEach(({ address }) => {
            console.log(`${dim('  Network     ')} > ${blue(`http://${address}:${bold(port)}/`)}`)
          }),
        )
    }

    console.log()
    console.log(`${dim('  shortcuts ')}   > ${underline('r')}${dim('estart | ')}${underline('o')}${dim('pen | ')}${underline('e')}${dim('dit')}`)
  }
  console.log()
  console.log()
}
