// @vitest-environment node
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createLockedAudioContainerRunner } from '../../../packages/advjs/node/audio/container-runner'

const profile = { id: 'release', ffmpegBuildFingerprint: 'a'.repeat(64), workerImageDigest: `sha256:${'b'.repeat(64)}` }
describe('approved audio container execution', () => {
  it('blocks an unknown profile/image before inspection and maps only bounded media paths to a networkless pinned worker', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-container-')))
    const execute = vi.fn(async (_command: string, args: readonly string[]) => ({ stdout: args[0] === 'image' ? profile.workerImageDigest : 'ffmpeg version fixture', stderr: '' }))
    try {
      await expect(createLockedAudioContainerRunner({ root, outputDirectory: 'output', profile, approvedProfiles: [], execute })).rejects.toThrow('UNAPPROVED')
      expect(execute).not.toHaveBeenCalled()
      const runner = await createLockedAudioContainerRunner({ root, outputDirectory: 'output', profile, approvedProfiles: [profile], execute })
      await runner('ffmpeg', ['-i', join(root, 'master.wav'), join(root, 'output/encoded.webm')])
      const args = execute.mock.calls[1]![1]
      expect(args).toContain('--network=none')
      expect(args).toContain('--pull=never')
      expect(args).toContain('--read-only')
      expect(args).toContain(profile.workerImageDigest)
      expect(args).toContain('/project/master.wav')
      expect(args).toContain('/project/output/encoded.webm')
      expect(args).toContain(`type=bind,source=${root},target=/project,readonly`)
      await expect(runner('sh', ['-c', 'echo forbidden'])).rejects.toThrow('COMMAND_INVALID')
      await expect(runner('ffmpeg', ['-i', '/outside/private.wav'])).rejects.toThrow('PATH_INVALID')
      expect(execute).toHaveBeenCalledTimes(2)
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })
  it('rejects a mismatched installed image before starting any media process', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-container-')))
    const execute = vi.fn(async () => ({ stdout: 'sha256:other-image', stderr: '' }))
    try {
      const runner = await createLockedAudioContainerRunner({ root, outputDirectory: 'output', profile, approvedProfiles: [profile], execute })
      await expect(runner('ffmpeg', ['-version'])).rejects.toThrow('IMAGE_MISMATCH')
      expect(execute).toHaveBeenCalledTimes(1)
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })
  it('selects a trusted daemon explicitly for both inspection and execution, rejecting argument injection before I/O', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-container-')))
    const execute = vi.fn(async (_command: string, args: readonly string[]) => ({ stdout: args[2] === 'image' ? profile.workerImageDigest : 'ffmpeg version fixture', stderr: '' }))
    try {
      await expect(createLockedAudioContainerRunner({ root, outputDirectory: 'output', profile, approvedProfiles: [profile], dockerContext: 'colima --host=untrusted', execute })).rejects.toThrow('CONTEXT_INVALID')
      expect(execute).not.toHaveBeenCalled()
      const runner = await createLockedAudioContainerRunner({ root, outputDirectory: 'output', profile, approvedProfiles: [profile], dockerContext: 'colima', execute })
      await runner('ffprobe', ['-version'])
      expect(execute.mock.calls[0]![1].slice(0, 3)).toEqual(['--context', 'colima', 'image'])
      expect(execute.mock.calls[1]![1].slice(0, 3)).toEqual(['--context', 'colima', 'run'])
      expect(execute.mock.calls.every(([, args]) => !args.includes('context') && !args.includes('use'))).toBe(true)
      expect(execute.mock.calls[1]![1]).toContain('--network=none')
      expect(execute.mock.calls[1]![1]).toContain('--read-only')
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })
})
