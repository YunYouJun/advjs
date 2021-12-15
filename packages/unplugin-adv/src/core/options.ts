import type { Options, ResolvedOptions } from '../types'

export function resolveOptions(userOptions: Options): ResolvedOptions {
  const options = Object.assign(
    {
      frontmatter: true,
      customSfcBlocks: ['route', 'i18n', 'style'],
      transforms: {},
    },
    userOptions,
  ) as ResolvedOptions
  return options
}
