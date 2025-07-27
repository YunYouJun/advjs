/* eslint-disable regexp/no-contradiction-with-assertion */
import type { AdvAst } from '@advjs/types'
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

function extractAdvScriptSetup(ast: AdvAst.Root) {
  const scripts: string[] = []

  /**
   * mount func to $adv.functions
   * @param name
   * @param value
   */
  function mountFunc(name: string, value: string) {
    scripts.push(`function ${name}(){${value}}`)
    scripts.push(`$adv.functions.${name} = ${name}`)
  }

  for (const funcName in ast.functions)
    mountFunc(funcName, ast.functions[funcName])

  return scripts
}

function extractCustomBlock(html: string, options: ResolvedMdOptions) {
  const blocks: string[] = []
  for (const tag of options.customSfcBlocks) {
    html = html.replace(
      new RegExp(`<${tag}[^>]*\\b[^>]*>[^<>]*<\\/${tag}>`, 'gm'),
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
    } :ast="advAst" class="w-full h-full">${html}</${wrapperComponent}>`

    if (transforms.after)
      html = transforms.after(html, id)

    const hoistScripts = extractScriptSetup(html)
    html = hoistScripts.html
    const customBlocks = extractCustomBlock(html, options)
    html = customBlocks.html

    const scriptLines: string[] = [
      'import { useAdvContext } from "@advjs/client"',
      'const { $adv } = useAdvContext()',
    ]

    const { parseAst } = await import('@advjs/parser')
    const advAst = await parseAst(raw)
    scriptLines.push(`const advAst = ${transformObject(advAst)}`)
    scriptLines.push('$adv.$logic.loadAst(advAst)')

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
      // extract adv.md code script
      ...extractAdvScriptSetup(advAst),
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
