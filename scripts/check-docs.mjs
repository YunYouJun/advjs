#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = join(repoRoot, 'docs')
const checkedRoots = [
  join(docsRoot, 'guide'),
  join(docsRoot, 'contributing', 'writing-guide.md'),
]

const diagnostics = []

function report(file, line, rule, message) {
  diagnostics.push({
    file: relative(repoRoot, file),
    line,
    message,
    rule,
  })
}

async function collectMarkdown(path) {
  const entryStat = await stat(path)
  if (entryStat.isFile())
    return extname(path) === '.md' ? [path] : []

  const entries = await readdir(path, { withFileTypes: true })
  const nested = await Promise.all(entries
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => collectMarkdown(join(path, entry.name))))
  return nested.flat()
}

function frontmatterEnd(lines) {
  if (lines[0] !== '---')
    return -1

  const end = lines.slice(1).findIndex(line => line === '---')
  return end === -1 ? -1 : end + 1
}

function stripLinkSuffix(target) {
  const hashIndex = target.indexOf('#')
  const queryIndex = target.indexOf('?')
  const indexes = [hashIndex, queryIndex].filter(index => index >= 0)
  return indexes.length ? target.slice(0, Math.min(...indexes)) : target
}

function blockPrefix(line) {
  let offset = 0
  while (line[offset] === ' ' && offset < 4)
    offset++
  return offset <= 3 ? line.slice(offset) : undefined
}

function parseFence(line) {
  const content = blockPrefix(line)
  if (!content || (content[0] !== '`' && content[0] !== '~'))
    return undefined

  const character = content[0]
  let length = 1
  while (content[length] === character)
    length++
  if (length < 3)
    return undefined

  return {
    character,
    info: content.slice(length).trim(),
    length,
  }
}

function parseHeading(line) {
  const content = blockPrefix(line)
  if (!content || content[0] !== '#')
    return undefined

  let level = 1
  while (content[level] === '#')
    level++
  if (level > 6 || !/\s/.test(content[level] || ''))
    return undefined

  return {
    level,
    text: content.slice(level).trim().replace(/\s+#+\s*$/, ''),
  }
}

function checkMarkdown(file, source) {
  const lines = source.split(/\r?\n/)
  const fmEnd = frontmatterEnd(lines)

  if (lines[0] === '---' && fmEnd === -1)
    report(file, 1, 'ADV-DOC-001', 'Frontmatter 缺少结束分隔符。')

  if (fmEnd >= 0) {
    const content = lines.slice(1, fmEnd).map(line => line.trim()).filter(Boolean)
    if (content.length === 1 && content[0] === 'outline: deep')
      report(file, 2, 'ADV-DOC-002', '`outline: deep` 已是站点默认值，请删除页面级 frontmatter。')
  }

  const headings = []
  let fence

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1
    const line = lines[index]

    if (fmEnd >= 0 && index <= fmEnd)
      continue

    const fenceMatch = parseFence(line)
    if (fence) {
      if (fenceMatch
        && fenceMatch.character === fence.character
        && fenceMatch.length >= fence.length
        && fenceMatch.info === '') {
        fence = undefined
      }
      continue
    }

    if (fenceMatch) {
      if (!fenceMatch.info)
        report(file, lineNumber, 'ADV-DOC-003', '围栏代码块必须声明语言；纯文本使用 `text`。')
      fence = {
        character: fenceMatch.character,
        length: fenceMatch.length,
      }
      continue
    }

    const headingMatch = parseHeading(line)
    if (headingMatch) {
      headings.push({
        level: headingMatch.level,
        line: lineNumber,
        text: headingMatch.text,
      })
    }

    const markdownLinks = line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)
    for (const match of markdownLinks) {
      const target = stripLinkSuffix(match[1])
      if (!target || /^(?:[a-z]+:|#|\/\/)/i.test(target))
        continue
      if (/\.(?:md|html)$/i.test(target))
        report(file, lineNumber, 'ADV-DOC-004', `站内链接省略 \`${extname(target)}\` 后缀：\`${match[1]}\`。`)
    }

    if (/!\[\s*\]\(/.test(line))
      report(file, lineNumber, 'ADV-DOC-005', '图片需要描述性替代文本；纯装饰图应由组件明确处理。')

    if (/https:\/\/cos\.advjs\.yunle\.fun\/games\/[^\s)`'"]+\.[a-f0-9]{12}\.(?:avif|ogg|webp)/i.test(line))
      report(file, lineNumber, 'ADV-DOC-006', '公共指南应引用素材逻辑 ID，不应固定具体哈希 COS URL。')

    if (line.includes('adv/assets/index.json'))
      report(file, lineNumber, 'ADV-DOC-011', '新文档只能使用 `adv/assets.json` 作为资源目录根。')

    if (file.endsWith('/guide/assets/catalog.md')
      && /"includes"\s*:/u.test(line)
      && !/"includes"\s*:\s*\[\s*"assets\//u.test(line)) {
      report(file, lineNumber, 'ADV-DOC-012', '资源分片 include 必须使用相对 `adv/` 的 `assets/*.json` 路径。')
    }
  }

  if (fence)
    report(file, lines.length, 'ADV-DOC-007', '围栏代码块没有闭合。')

  const h1 = headings.filter(heading => heading.level === 1)
  if (h1.length !== 1)
    report(file, h1[1]?.line || h1[0]?.line || 1, 'ADV-DOC-008', `每篇文档必须恰好包含一个一级标题，当前为 ${h1.length} 个。`)
  if (headings[0] && headings[0].level !== 1)
    report(file, headings[0].line, 'ADV-DOC-009', '正文的第一个标题必须是一级标题。')

  for (let index = 1; index < headings.length; index++) {
    const previous = headings[index - 1]
    const current = headings[index]
    if (current.level > previous.level + 1)
      report(file, current.line, 'ADV-DOC-010', `标题从 H${previous.level} 跳到 H${current.level}。`)
  }
}

const files = (await Promise.all(checkedRoots.map(collectMarkdown))).flat().sort()
for (const file of files)
  checkMarkdown(file, await readFile(file, 'utf8'))

diagnostics.sort((a, b) => (
  a.file.localeCompare(b.file)
  || a.line - b.line
  || a.rule.localeCompare(b.rule)
))

if (diagnostics.length) {
  for (const diagnostic of diagnostics)
    console.error(`${diagnostic.file}:${diagnostic.line} ${diagnostic.rule} ${diagnostic.message}`)
  console.error(`\n文档检查失败：${diagnostics.length} 个问题，检查了 ${files.length} 个文件。`)
  process.exitCode = 1
}
else {
  console.log(`文档检查通过：${files.length} 个文件。`)
}
