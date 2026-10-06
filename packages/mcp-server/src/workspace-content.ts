import type { AdvAssetManifest, AdvCharacter, AdvProjectChapter, AdvProjectScene, AdvProjectSourceMap } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createAdvAssetCatalog } from '@advjs/core'
import { exportCharacterForAI } from '@advjs/parser'
import { isAbsolute, relative, resolve } from 'pathe'
import { z } from 'zod'

export const workspaceItemKindSchema = z.enum(['characters', 'chapters', 'scenes'])
export type WorkspaceItemKind = z.infer<typeof workspaceItemKindSchema>
const itemSchema = z.object({ id: z.string(), title: z.string(), paths: z.array(z.string()), states: z.number().optional() })
export const workspaceContentSchema = z.object({
  characters: z.array(itemSchema),
  chapters: z.array(itemSchema),
  scenes: z.array(itemSchema),
})

/** Authoring data loaded through the same project compiler as Studio. */
export interface WorkspaceProject {
  id: string
  chapters: AdvProjectChapter[]
  characters: AdvCharacter[]
  scenes: AdvProjectScene[]
  assets?: AdvAssetManifest
}

export interface WorkspaceContentSource {
  files: Record<string, string>
  result: { project: WorkspaceProject, sourceMap?: AdvProjectSourceMap }
}

/** A small index, without images or full author documents in the model's result. */
export function workspaceContentIndex({ result }: WorkspaceContentSource): z.infer<typeof workspaceContentSchema> {
  const { project, sourceMap } = result
  return {
    characters: project.characters.map(character => ({
      id: character.id,
      title: character.name,
      paths: sourceMap?.characters[character.id] ? [sourceMap.characters[character.id]] : [],
      states: Object.keys(character.avatars ?? {}).length + (character.avatar && !Object.hasOwn(character.avatars ?? {}, 'default') ? 1 : 0),
    })),
    chapters: project.chapters.map(chapter => ({ id: chapter.id, title: chapter.title || chapter.id, paths: chapter.sources })),
    scenes: project.scenes.map(scene => ({ id: scene.id, title: scene.name || scene.id, paths: sourceMap?.scenes[scene.id] ? [sourceMap.scenes[scene.id]] : [] })),
  }
}

interface PreviewImage {
  key: string
  state?: string
  label: string
  path: string
  group: 'portrait' | 'reference' | 'scene'
  status?: 'ready' | 'missing' | 'unsupported' | 'outside_project' | 'too_large'
}

function imageMime(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp'
}

async function imagePreview(root: string, path: string, budget: number): Promise<{ status: PreviewImage['status'], src?: string, bytes?: number }> {
  if (!path || isAbsolute(path) || /^[a-z]:/iu.test(path) || path.includes('\\') || path.split('/').includes('..'))
    return { status: 'outside_project' }
  if (/^[a-z][a-z\d+.-]*:/iu.test(path))
    return { status: 'unsupported' }
  try {
    const projectRoot = await realpath(root)
    const file = await realpath(resolve(projectRoot, path))
    const portablePath = relative(projectRoot, file)
    if (!portablePath || portablePath.startsWith('../') || isAbsolute(portablePath))
      return { status: 'outside_project' }
    const info = await stat(file)
    if (!info.isFile())
      return { status: 'unsupported' }
    if (info.size > Math.min(512 * 1024, budget))
      return { status: 'too_large' }
    const bytes = await readFile(file)
    if (bytes.length > Math.min(512 * 1024, budget))
      return { status: 'too_large' }
    const mime = imageMime(bytes)
    if (!mime)
      return { status: 'unsupported' }
    return { status: 'ready', src: `data:${mime};base64,${bytes.toString('base64')}`, bytes: bytes.length }
  }
  catch {
    return { status: 'missing' }
  }
}

/** Read one compiled item; bounded local images stay in app-only metadata. */
export async function readWorkspaceItem(source: WorkspaceContentSource, root: string, kind: WorkspaceItemKind, id: string) {
  const { project } = source.result
  const entry = workspaceContentIndex(source)[kind].find(item => item.id === id)
  if (!entry)
    throw new Error('Workspace item no longer exists. Refresh the project.')
  const images: PreviewImage[] = []
  let context = ''
  let character: AdvCharacter | undefined
  let scene: AdvProjectScene | undefined
  const files = entry.paths.filter(path => Object.hasOwn(source.files, path)).map(path => ({ path, text: source.files[path] }))
  if (kind === 'characters') {
    character = project.characters.find(item => item.id === id)!
    context = exportCharacterForAI(character)
    const variants = { ...(character.avatars ?? {}) }
    if (!Object.hasOwn(variants, 'default') && character.avatar)
      variants.default = { src: character.avatar }
    for (const [state, portrait] of Object.entries(variants))
      images.push({ key: `portrait:${state}`, state, label: portrait.label || state, path: portrait.src, group: 'portrait' })
    for (const [index, reference] of (character.visual?.references ?? []).entries())
      images.push({ key: `reference-${index}`, label: reference.description || character.name, path: reference.path, group: 'reference' })
  }
  else {
    context = files.map(file => `${file.path}\n\n${file.text}`).join('\n\n')
    if (kind === 'scenes') {
      scene = project.scenes.find(item => item.id === id)!
      let path = scene.src
      if (scene.assetId && project.assets) {
        const catalog = createAdvAssetCatalog(project.assets, { profile: project.assets.profiles.local ? 'local' : undefined })
        try {
          path = (await catalog.resolve(scene.assetId)).src
        }
        catch {
          path = undefined
        }
        finally {
          catalog.dispose()
        }
      }
      if (path)
        images.push({ key: 'scene', label: entry.title, path, group: 'scene' })
      if (!context)
        context = JSON.stringify(scene, null, 2)
    }
  }
  const imageData: Record<string, string> = Object.create(null)
  let budget = 512 * 1024
  for (const image of images) {
    const preview = await imagePreview(root, image.path, budget)
    image.status = preview.status
    if (preview.src) {
      imageData[image.key] = preview.src
      budget -= preview.bytes ?? 0
    }
  }
  return {
    content: [{ type: 'text' as const, text: `${entry.title} (${kind})` }],
    structuredContent: { item: { ...entry, kind, projectId: project.id, files, character, scene, context, images } },
    _meta: { 'advjs/images': imageData },
  }
}
