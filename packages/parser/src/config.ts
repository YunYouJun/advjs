import type { AdvConfig } from '@advjs/types'

export function resolveConfig(frontmatter: any) {
  const config: AdvConfig = {
    ...frontmatter,
  }

  return config
}
