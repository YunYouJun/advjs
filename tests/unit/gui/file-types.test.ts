import { consola } from 'consola'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFileTypeFromPath } from '../../../packages/gui/client/utils/fs'

afterEach(() => vi.restoreAllMocks())

describe('explorer extensionless filenames', () => {
  it('treats a root LICENSE as a generic file without an unknown extension warning', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    expect(getFileTypeFromPath('LICENSE')).toBe('file')
    expect(warn).not.toHaveBeenCalled()
  })

  it('extracts extensions from the filename rather than a dotted parent directory', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    expect(getFileTypeFromPath('project.with-dot/LICENSE')).toBe('file')
    expect(getFileTypeFromPath('project.with-dot\\LICENSE')).toBe('file')
    expect(getFileTypeFromPath('project.with-dot/story.md')).toBe('md')
    expect(warn).not.toHaveBeenCalled()
  })

  it('retains the existing diagnostic for an unknown real extension', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    expect(getFileTypeFromPath('project.with-dot/data.unknown')).toBe('unknown')
    expect(warn).toHaveBeenCalledExactlyOnceWith('unknown file type:', 'project.with-dot/data.unknown')
  })
})
