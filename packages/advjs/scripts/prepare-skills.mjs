#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repositoryRoot = resolve(packageRoot, '../..')
const sourceRoot = resolve(repositoryRoot, 'skills')

function readOutput(argv) {
  if (argv.length === 0)
    return resolve(packageRoot, 'skills')
  if (argv.length === 2 && argv[0] === '--output')
    return resolve(argv[1])
  throw new Error('Usage: prepare-skills.mjs [--output <directory>]')
}

const outputRoot = readOutput(process.argv.slice(2))
const catalog = JSON.parse(await readFile(resolve(sourceRoot, 'catalog.json'), 'utf8'))
const publicSkills = [
  ...catalog.groups.default,
  ...catalog.groups.optional,
].sort()
const repositoryOnly = new Set(catalog.groups.repositoryOnly)

for (const skill of publicSkills) {
  if (repositoryOnly.has(skill))
    throw new Error(`Repository-only Skill cannot be published: ${skill}`)
}

await mkdir(dirname(outputRoot), { recursive: true })
const temporaryRoot = await mkdtemp(resolve(dirname(outputRoot), '.advjs-skills-'))

try {
  await cp(resolve(sourceRoot, 'README.md'), resolve(temporaryRoot, 'README.md'))
  await cp(resolve(sourceRoot, 'catalog.json'), resolve(temporaryRoot, 'catalog.json'))
  for (const skill of publicSkills)
    await cp(resolve(sourceRoot, skill), resolve(temporaryRoot, skill), { recursive: true })

  await rm(outputRoot, { force: true, recursive: true })
  await rename(temporaryRoot, outputRoot)
}
catch (error) {
  await rm(temporaryRoot, { force: true, recursive: true })
  throw error
}
