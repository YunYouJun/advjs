import matter from 'gray-matter'
import { parseAst } from '@advjs/parser'
import type { ResolvedOptions } from '../types'
import { checkAdvMd } from './check'
/**
 * transform obj for vite code
 * @param obj
 * @returns
 */
export const transformObject = (obj: any) => {
  return `JSON.parse(${JSON.stringify(JSON.stringify(obj))})`
}

const scriptSetupRE = /<\s*script[^>]*\bsetup\b[^>]*>([\s\S]*)<\/script>/gm
const defineExposeRE = /defineExpose\s*\(/gm

function extractScriptSetup(html: string) {
  const scripts: string[] = []
  html = html.replace(scriptSetupRE, (_, script) => {
    scripts.push(script)
    return ''
  })

  return { html, scripts }
}

function extractCustomBlock(html: string, options: ResolvedOptions) {
  const blocks: string[] = []
  for (const tag of options.customSfcBlocks) {
    html = html.replace(
      new RegExp(`<${tag}[^>]*\\b[^>]*>[^<>]*<\\/${tag}>`, 'mg'),
      (code) => {
        blocks.push(code)
        return ''
      },
    )
  }

  return { html, blocks }
}

export function createMarkdown(options: ResolvedOptions) {
  const {
    transforms,
    headEnabled,
    frontmatterPreprocess,
  } = options

  return async (id: string, raw: string) => {
    raw = raw.trimStart()

    checkAdvMd(raw)

    if (transforms.before)
      raw = transforms.before(raw, id)

    const { data } = matter(raw)

    let html = ''
    const wrapperComponent = 'AdvGame'
    html = `<${wrapperComponent}${
      options.frontmatter ? ' :frontmatter="frontmatter"' : ''
    } :ast="advAst" :info="advInfo">${html}</${wrapperComponent}>`

    if (transforms.after)
      html = transforms.after(html, id)

    const hoistScripts = extractScriptSetup(html)
    html = hoistScripts.html
    const customBlocks = extractCustomBlock(html, options)
    html = customBlocks.html

    const scriptLines: string[] = []

    const { advAst, info } = await parseAst(raw)
    scriptLines.push(`const advAst = ${transformObject(advAst)}`)
    scriptLines.push(`const advInfo = ${JSON.stringify(info)}`)

    if (options.frontmatter) {
      const { head, frontmatter } = frontmatterPreprocess(data || {}, options)
      // to delete
      scriptLines.push(`const frontmatter = ${JSON.stringify(frontmatter)}`)

      if (!defineExposeRE.test(hoistScripts.scripts.join('')))
        scriptLines.push('defineExpose({ frontmatter })')

      if (headEnabled && head) {
        scriptLines.push(`const head = ${JSON.stringify(head)}`)
        scriptLines.unshift('import { useHead } from "@vueuse/head"')
        scriptLines.push('useHead(head)')
      }
    }

    scriptLines.push(...hoistScripts.scripts)

    const scripts = `<script setup>\n${scriptLines.join('\n')}\n</script>`

    const sfc = `<template>${html}</template>\n${scripts}\n${customBlocks.blocks.join(
      '\n',
    )}\n`

    return sfc
  }
}
