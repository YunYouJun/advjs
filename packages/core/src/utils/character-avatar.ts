import type { AdvCharacterFrontmatter } from '@advjs/types'

export interface ResolvedCharacterAvatar {
  src?: string
  label?: string
  status: string
}

/** Resolve a dialogue's explicit portrait state with the legacy avatar as fallback. */
export function resolveCharacterAvatar(
  character: Pick<AdvCharacterFrontmatter, 'id' | 'avatar' | 'avatars'> | undefined,
  status?: string,
): ResolvedCharacterAvatar {
  const key = status?.trim() || 'default'
  const variants = character?.avatars
  const variant = variants && Object.hasOwn(variants, key) ? variants[key] : undefined
  if (variant?.src)
    return { ...variant, status: key }
  const fallback = variants && Object.hasOwn(variants, 'default') ? variants.default : undefined
  return { src: character?.avatar || fallback?.src, label: fallback?.label, status: 'default' }
}
