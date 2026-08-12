#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const GROUPS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactors'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['chore', 'Maintenance'],
  ['other', 'Other'],
]

function parseSubject(subject) {
  const match = /^(feat|fix|perf|refactor|docs|test|build|ci|chore)(?:\(([^)]+)\))?!?: ([^\r\n]+)$/u.exec(subject)
  return match
    ? { group: match[1], scope: match[2], subject: match[3] }
    : { group: 'other', subject }
}

export async function generateChangelog(options) {
  const root = resolve(options.root)
  const range = options.from ? `${options.from}..${options.to}` : options.to
  const { stdout } = await execFileAsync('git', ['log', '--format=%H%x09%s', '--no-merges', range], {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
  })
  const entries = stdout.trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('\t')
    const sha = line.slice(0, separator)
    return { sha, ...parseSubject(line.slice(separator + 1)) }
  })
  const lines = [`# ${options.version}`, '', `Source: \`${options.to}\``, '']
  for (const [group, title] of GROUPS) {
    const matches = entries.filter(entry => entry.group === group)
    if (matches.length === 0)
      continue
    lines.push(`## ${title}`, '')
    for (const entry of matches)
      lines.push(`- ${entry.scope ? `**${entry.scope}:** ` : ''}${entry.subject} (${entry.sha.slice(0, 7)})`)
    lines.push('')
  }
  if (entries.length === 0)
    lines.push('No source changes in this range.', '')
  return `${lines.join('\n').trim()}\n`
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [from, to, version] = process.argv.slice(2)
  if (!to || !version) {
    process.stderr.write('Usage: changelog.mjs <from> <to> <version>\n')
    process.exitCode = 1
  }
  else {
    generateChangelog({ from: from === '-' ? undefined : from, root: process.cwd(), to, version })
      .then(content => process.stdout.write(content))
      .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
        process.exitCode = 1
      })
  }
}
