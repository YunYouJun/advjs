import type { IFileSystem } from './fs'
import { commitStudioProjectFiles } from './nativeProjectMutation'
import { whenStudioProjectWritesSettle } from './projectWriteQueue'

export interface StudioContentSource {
  readonly fs: IFileSystem
  readonly path: string
  readonly content: string | null
}

function assertPath(path: string) {
  if (!/^(?:adv\.config\.json|adv\/.+\.(?:md|json))$/u.test(path) || path.includes('\\')
    || Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))) {
    throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
  }
}

/** Read a saved author file without treating permission or storage errors as absence. */
export async function readStudioContentSource(fs: IFileSystem, path: string, assertCurrent: () => void): Promise<StudioContentSource> {
  assertPath(path)
  assertCurrent()
  await whenStudioProjectWritesSettle(fs)
  assertCurrent()
  await fs.refresh?.()
  assertCurrent()
  const content = await fs.exists(path) ? await fs.readFile(path) : null
  assertCurrent()
  return Object.freeze({ fs, path, content })
}

/** An open file or delete confirmation authorizes only these exact source bytes. */
export async function commitStudioContentSource(source: StudioContentSource, content: string | null, assertCurrent: () => void) {
  assertPath(source.path)
  await commitStudioProjectFiles(source.fs, [{ path: source.path, expected: source.content, content }], {
    assertCurrent,
    acceptsPath: path => path === source.path,
  })
}

export function isStudioContentConflict(error: unknown) {
  return error instanceof Error && /ADV_STUDIO_(?:CONTENT_SCOPE_CHANGED|SOURCE_CONFLICT)/.test(error.message)
}
