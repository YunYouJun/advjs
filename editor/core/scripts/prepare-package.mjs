import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, '.output/public')
const destination = resolve(root, 'dist')

await rm(destination, { force: true, recursive: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })

process.stderr.write(`Prepared @advjs/editor package UI at ${destination}\n`)
