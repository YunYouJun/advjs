import type { AdvData } from '../../types'
// import { dirname } from 'path'
import { read } from 'to-vfile'

import { matter } from 'vfile-matter'
import { resolveConfig } from './config'

export * from './core'

/**
 * will depend node:fs
 */
export async function load(filepath: string) {
  const data = await parse(filepath)

  const entries = new Set([
    filepath,
  ])
  data.entries = Array.from(entries)

  // todo add 'src' for child frontmatter

  return data
}

/**
 * parse adv.md config
 * @param filepath
 */
export async function parse(filepath: string): Promise<AdvData> {
  const file = await read(filepath)
  matter(file, { strip: true })

  const config = resolveConfig(file.data)

  return {
    file,
    raw: String(file),
    filepath,
    config,
    frontmatter: file.data,
  } as AdvData
}
