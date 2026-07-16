/* eslint-disable regexp/no-contradiction-with-assertion */
import type { ResolvedMdOptions } from './types'
import { read } from 'to-vfile'
import { matter } from 'vfile-matter'
import { checkAdvMd } from './check'

/**
 * transform obj for vite code
 * @param obj
 */
export function transformObject(obj: any) {
  return `JSON.parse(${JSON.stringify(JSON.stringify(obj))})`
}

const scriptSetupRE = /<\s*script[^>]*\bsetup\b[^>]*>([\s\S]*)<\/script>/g
const defineExposeRE = /defineExpose\s*\(/g

function extractScriptSetup(html: string) {
  const scripts: string[] = []
  html = html.replace(scriptSetupRE, (_, script) => {
    scripts.push(script)
    return ''
  })

  return { html, scripts }
}

function extractCustomBlock(html: string, options: ResolvedMdOptions) {
  const blocks: string[] = []
  const regexCache = new Map<string, RegExp>()

  for (const tag of options.customSfcBlocks) {
    let regex = regexCache.get(tag)
    if (!regex) {
      regex = new RegExp(`<${tag}[^>]*\\b[^>]*>[^<>]*<\\/${tag}>`, 'gm')
      regexCache.set(tag, regex)
    }
    html = html.replace(
      regex,
      (code) => {
        blocks.push(code)
        return ''
      },
    )
  }

  return { html, blocks }
}

export function createMarkdown(options: ResolvedMdOptions) {
  const {
    transforms,
    headEnabled,
    frontmatterPreprocess,
  } = options

  return async (id: string, raw: string) => {
    raw = raw.trimStart()

    checkAdvMd(raw, id)

    if (transforms.before)
      raw = transforms.before(raw, id)

    const file = await read(id)
    matter(file, { strip: true })

    // todo: judge to insert <AdvBabylonCanvas />
    let html = ''
    const wrapperComponent = 'AdvGame'
    html = `<${wrapperComponent}${
      options.frontmatter ? ' :frontmatter="frontmatter"' : ''
    } class="w-full h-full">${html}</${wrapperComponent}>`

    if (transforms.after)
      html = transforms.after(html, id)

    const hoistScripts = extractScriptSetup(html)
    html = hoistScripts.html
    const customBlocks = extractCustomBlock(html, options)
    html = customBlocks.html

    const scriptLines: string[] = []

    if (options.frontmatter) {
      const { head, frontmatter } = frontmatterPreprocess(file.data || {}, options)
      // to delete
      scriptLines.push(`const frontmatter = ${transformObject(frontmatter)}`)

      if (!defineExposeRE.test(hoistScripts.scripts.join('')))
        scriptLines.push('defineExpose({ frontmatter })')

      if (headEnabled && head) {
        scriptLines.unshift('import { useHead } from "@unhead/vue"')
        scriptLines.push(`const head = ${JSON.stringify(head)}`)
        scriptLines.push('useHead(head)')
      }
    }

    // todo: use ts file
    const vueSrc = [
      '<script setup>',
      ...scriptLines,
      ...hoistScripts.scripts,
      '</script>',
      '',
      '<template>',
      html,
      ...customBlocks.blocks,
      '</template>',
    ].join('\n')

    return {
      // code
      vueSrc,
    }
  }
}
