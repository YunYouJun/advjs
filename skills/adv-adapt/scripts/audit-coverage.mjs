#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u
const SOURCE_ANCHOR_PATTERN = /<!--\s*source:([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\s*-->/gu

function printResult(result, failed = false) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (failed)
    process.exitCode = 1
}

async function collectChapterFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...await collectChapterFiles(path))
    else if (entry.isFile() && extname(entry.name) === '.md' && entry.name.endsWith('.adv.md'))
      files.push(path)
  }

  return files
}

function validateManifest(manifest) {
  const errors = []
  const sections = new Map()

  if (manifest?.schemaVersion !== 1)
    errors.push('schemaVersion must be 1')
  if (!Array.isArray(manifest?.sources) || manifest.sources.length === 0)
    errors.push('sources must contain at least one work')

  for (const source of manifest?.sources ?? []) {
    if (!ID_PATTERN.test(source?.id ?? '')) {
      errors.push(`invalid source id: ${String(source?.id ?? '')}`)
      continue
    }
    if (!Array.isArray(source.sections) || source.sections.length === 0)
      errors.push(`source ${source.id} must contain sections`)

    for (const section of source.sections ?? []) {
      if (!ID_PATTERN.test(section?.id ?? '')) {
        errors.push(`invalid section id: ${source.id}/${String(section?.id ?? '')}`)
        continue
      }

      const key = `${source.id}/${section.id}`
      if (sections.has(key))
        errors.push(`duplicate manifest section: ${key}`)
      else
        sections.set(key, { required: section.required === true })
    }
  }

  return { errors, sections }
}

async function main() {
  const [manifestPath, chaptersDirectory, ...extra] = process.argv.slice(2)
  if (!manifestPath || !chaptersDirectory || extra.length > 0) {
    printResult({
      error: 'usage: node audit-coverage.mjs <manifest.json> <chapters-dir>',
    }, true)
    return
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const { errors, sections } = validateManifest(manifest)
    const occurrences = new Map()

    for (const file of await collectChapterFiles(chaptersDirectory)) {
      const content = await readFile(file, 'utf8')
      for (const match of content.matchAll(SOURCE_ANCHOR_PATTERN)) {
        const key = `${match[1]}/${match[2]}`
        const locations = occurrences.get(key) ?? []
        const line = content.slice(0, match.index).split('\n').length
        locations.push(`${relative(chaptersDirectory, file)}:${line}`)
        occurrences.set(key, locations)
      }
    }

    const requiredKeys = [...sections]
      .filter(([, section]) => section.required)
      .map(([key]) => key)
      .sort()
    const missing = requiredKeys.filter(key => !occurrences.has(key))
    const duplicates = [...occurrences]
      .filter(([, locations]) => locations.length > 1)
      .map(([key]) => key)
      .sort()
    const unknown = [...occurrences.keys()]
      .filter(key => !sections.has(key))
      .sort()
    const covered = requiredKeys.length - missing.length
    const coveragePercent = requiredKeys.length === 0
      ? 100
      : Math.round((covered / requiredKeys.length) * 10000) / 100

    printResult({
      required: requiredKeys.length,
      covered,
      coveragePercent,
      missing,
      duplicates,
      unknown,
      manifestErrors: errors.sort(),
      anchors: Object.fromEntries([...occurrences].sort(([a], [b]) => a.localeCompare(b))),
    }, errors.length > 0 || missing.length > 0 || duplicates.length > 0 || unknown.length > 0)
  }
  catch (error) {
    printResult({
      error: error instanceof Error ? error.message : String(error),
    }, true)
  }
}

await main()
