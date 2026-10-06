import type { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'pathe'

export class EditorMutationError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}
export interface EditorFileChange {
  path: string
  content: string | null
  expected: string | null
}
export function projectRelativePath(path: string) {
  if (typeof path !== 'string' || !path || path.includes('\0'))
    throw new EditorMutationError(400, 'Project-relative path required')
  const normalized = path.replaceAll('\\', '/')
  if (isAbsolute(normalized) || /^[a-z]:/iu.test(normalized))
    throw new EditorMutationError(400, 'Absolute paths are not allowed')
  const segments = normalized.split('/').filter(part => part && part !== '.')
  if (!segments.length || segments.some(part => ['..', '.git', 'node_modules'].includes(part)))
    throw new EditorMutationError(400, 'Unsafe project path')
  return segments.join('/')
}
function assertWithin(root: string, target: string) {
  const path = relative(root, target)
  if (isAbsolute(path) || path === '..' || path.startsWith('../'))
    throw new EditorMutationError(403, 'Project symlink escapes the workspace')
}
/** Create each parent only after validating its real path. */
export async function projectWriteTarget(root: string, path: string) {
  root = await realpath(root)
  const normalized = projectRelativePath(path)
  const segments = normalized.split('/')
  let directory = root
  for (const segment of segments.slice(0, -1)) {
    const next = resolve(directory, segment)
    await mkdir(next).catch((error) => {
      if (error.code !== 'EEXIST')
        throw error
    })
    directory = await realpath(next)
    assertWithin(root, directory)
    if (!(await stat(directory)).isDirectory())
      throw new EditorMutationError(400, 'Project parent is not a directory')
  }
  const target = resolve(directory, segments.at(-1)!)
  const actual = await realpath(target).catch(() => undefined)
  if (actual) {
    assertWithin(root, actual)
    if (!(await stat(actual)).isFile())
      throw new EditorMutationError(400, 'Project target is not a file')
  }
  return target
}
export async function atomicProjectWrite(target: string, content: string | Buffer) {
  const temporary = resolve(dirname(target), `.advjs-write-${randomUUID()}`)
  try {
    await writeFile(temporary, content, { flag: 'wx' })
    await rename(temporary, target)
  }
  finally {
    await rm(temporary, { force: true })
  }
}
/** Optimistic source revision. Each file is atomically replaced; this is not a disk transaction. */
export async function applyEditorFileChanges(root: string, changes: EditorFileChange[]) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 100)
    throw new EditorMutationError(400, 'Expected 1–100 file changes')
  const entries: { target: string, change: EditorFileChange }[] = []
  const paths = new Set<string>()
  for (const change of changes) {
    if (!change || (typeof change.content !== 'string' && change.content !== null)
      || (typeof change.expected !== 'string' && change.expected !== null)) {
      throw new EditorMutationError(400, 'Invalid file change')
    }
    const path = projectRelativePath(change.path)
    if (!/\.(?:md|json)$/iu.test(path) || paths.has(path))
      throw new EditorMutationError(400, 'Changes require distinct Markdown/JSON files')
    paths.add(path)
    const target = await projectWriteTarget(root, path)
    const original = await readFile(target, 'utf8').catch((error) => {
      if (error.code === 'ENOENT')
        return null
      throw error
    })
    if (original !== change.expected)
      throw new EditorMutationError(409, `External changes conflict with the draft: ${path}`)
    entries.push({ target, change })
  }
  const written: typeof entries = []
  try {
    for (const entry of entries) {
      // Recheck immediately before each write, including changes during validation.
      const current = await readFile(entry.target, 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
      if (current !== entry.change.expected)
        throw new EditorMutationError(409, `External changes conflict with the draft: ${entry.change.path}`)
      if (entry.change.content === null)
        await rm(entry.target)
      else await atomicProjectWrite(entry.target, entry.change.content)
      written.push(entry)
    }
  }
  catch (error) {
    for (const entry of written.reverse()) {
      // Never overwrite another author's subsequent edit during rollback.
      const current = await readFile(entry.target, 'utf8').catch(() => null)
      if (current !== entry.change.content)
        continue
      if (entry.change.expected === null)
        await rm(entry.target, { force: true })
      else await atomicProjectWrite(entry.target, entry.change.expected)
    }
    throw error
  }
  return { paths: [...paths] }
}
