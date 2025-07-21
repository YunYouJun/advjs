import type { Options, ResolvedMdOptions } from './types'
import { preprocessHead } from './head'

export function resolveMdOptions(userOptions: Options = {}): ResolvedMdOptions {
  const options = Object.assign(
    {
      headEnabled: false,
      headField: '',
      frontmatter: true,
      customSfcBlocks: ['route', 'i18n', 'style'],
      transforms: {},
      frontmatterPreprocess: (frontmatter: any, options: ResolvedMdOptions) => {
        const head = preprocessHead(frontmatter, options)
        return { head, frontmatter }
      },
    },
    userOptions,
  ) as ResolvedMdOptions
  return options
}
