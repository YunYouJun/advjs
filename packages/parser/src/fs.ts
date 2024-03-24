// import { dirname } from 'path'
import type { AdvMarkdown, AdvThemeMeta } from '@advjs/types'
import consola from 'consola'
import { matter } from 'vfile-matter'
import { read } from 'to-vfile'

import { resolveConfig } from './config'

export * from './core'

/**
 * will depend node:fs
 */
export async function load(filepath: string, themeMeta?: AdvThemeMeta) {
  const data = await parse(filepath)

  const entries = new Set([
    filepath,
  ])
  data.entries = Array.from(entries)

  if (themeMeta)
    consola.info('themeMeta', themeMeta)

  // todo add 'src' for child frontmatter

  return data
}

/**
 * parse adv.md config
 * @param filepath
 */
export async function parse(filepath: string): Promise<AdvMarkdown> {
  const file = await read(filepath)
  matter(file, { strip: true })

  const config = resolveConfig(file.data)

  return {
    file,
    raw: String(file),
    filepath,
    config,
    features: config.features,
    frontmatter: file.data,
  }
}
