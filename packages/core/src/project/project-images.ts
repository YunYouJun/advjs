import { isSafeProjectPackagePath } from './package'
import { PROJECT_SLUG_RE, toProjectSlug } from './slug'

export const PROJECT_COVER_KEY = 'cover'

export function isProjectImagePath(path: string): boolean {
  return isSafeProjectPackagePath(path) && !path.includes(':')
}

export function projectImagePath(kind: 'character' | 'scene' | 'cover', id: string, label: string, digest: string, extension: string): string {
  if (!/^[a-f\d]{64}$/u.test(digest) || !/^(?:png|jpg|gif|webp)$/u.test(extension))
    throw new Error('Invalid project image')
  const name = toProjectSlug(label).slice(0, 48) || 'image'
  if (kind === 'cover')
    return `adv/assets/cover/${name}.${digest}.${extension}`
  const owner = PROJECT_SLUG_RE.test(id) ? id : toProjectSlug(id) || 'entry'
  const directory = kind === 'character' ? 'characters' : 'scenes'
  return `adv/assets/${directory}/${owner}/${name}.${digest}.${extension}`
}

/**
 * Read the cover independently so existing or malformed optional cover values
 * never prevent authors from compiling the project.
 */
export function readProjectCover(source: string | undefined): string | undefined {
  if (!source)
    return undefined
  const settings: unknown = JSON.parse(source)
  if (!settings || typeof settings !== 'object' || !(PROJECT_COVER_KEY in settings))
    return undefined
  const cover = settings[PROJECT_COVER_KEY]
  return typeof cover === 'string' && isProjectImagePath(cover) ? cover : undefined
}

export function writeProjectCover(source: string | undefined, path: string | undefined): string {
  const settings: unknown = JSON.parse(source ?? '{}')
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || (path !== undefined && !isProjectImagePath(path)))
    throw new Error('Invalid project cover settings')
  const next = { ...settings, [PROJECT_COVER_KEY]: path }
  return `${JSON.stringify(next, null, 2)}\n`
}
