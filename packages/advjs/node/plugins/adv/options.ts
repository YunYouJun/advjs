import type { Options, ResolvedOptions } from './types'
import { preprocessHead } from './head'

export function resolveOptions(userOptions: Options = {}): ResolvedOptions {
  const options = Object.assign(
    {
      headEnabled: false,
      headField: '',
      frontmatter: true,
      customSfcBlocks: ['route', 'i18n', 'style'],
      transforms: {},
      frontmatterPreprocess: (frontmatter: any, options: ResolvedOptions) => {
        const head = preprocessHead(frontmatter, options)
        return { head, frontmatter }
      },
    },
    userOptions,
  ) as ResolvedOptions
  return options
}
