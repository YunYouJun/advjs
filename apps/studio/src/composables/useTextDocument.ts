import type { IFileSystem } from '../utils/fs'
import type { StudioContentSource } from '../utils/projectContentMutation'
import { commitStudioContentSource, readStudioContentSource } from '../utils/projectContentMutation'

/** Keeps the opened file's baseline separate from both the live FS and the author's draft. */
export function useTextDocument(getFs: () => IFileSystem | null, getProjectId: () => string | undefined) {
  let generation = 0
  let current: { source: StudioContentSource, assertCurrent: () => void } | undefined
  let saving = false

  function reset() {
    generation += 1
    current = undefined
  }

  async function read(path: string) {
    reset()
    const token = generation
    const fs = getFs()
    const projectId = getProjectId()
    if (!fs || !projectId)
      throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    const assertCurrent = () => {
      if (token !== generation || getFs() !== fs || getProjectId() !== projectId)
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    }
    const source = await readStudioContentSource(fs, path, assertCurrent)
    current = { source, assertCurrent }
    return source.content
  }

  async function save(path: string, content: string) {
    if (!current || current.source.path !== path)
      throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    if (saving)
      throw new Error('ADV_STUDIO_CONTENT_SAVE_BUSY')
    const opened = current
    opened.assertCurrent()
    saving = true
    try {
      await commitStudioContentSource(opened.source, content, opened.assertCurrent)
      opened.assertCurrent()
      current = { ...opened, source: Object.freeze({ ...opened.source, content }) }
      return content
    }
    finally {
      saving = false
    }
  }

  return { read, save, reset }
}
