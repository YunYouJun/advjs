import type { AudioApprovedToolchainProfile } from '@advjs/types'
import type { AudioProcessRunner } from './process'
import { mkdir, realpath } from 'node:fs/promises'
import process from 'node:process'
import { assertAudioReleaseToolchain } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { runAudioProcess } from './process'

/** Trusted host chooses an already installed image by exact image ID, never a tag/pull. */
export async function createLockedAudioContainerRunner(options: {
  root: string
  outputDirectory: string
  profile: AudioApprovedToolchainProfile
  approvedProfiles: readonly AudioApprovedToolchainProfile[]
  /** Explicit trusted daemon selection; never changes the user's global context. */
  dockerContext?: string
  /** Host/test executable adapter, not project or HTTP input. */
  execute?: AudioProcessRunner
}): Promise<AudioProcessRunner> {
  const profile = structuredClone(options.profile)
  assertAudioReleaseToolchain({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest }, profile.ffmpegBuildFingerprint, options.approvedProfiles)
  if (options.dockerContext !== undefined && !/^[a-zA-Z0-9][\w.-]{0,127}$/u.test(options.dockerContext))
    throw new Error('AUDIO_CONTAINER_CONTEXT_INVALID')
  const dockerArguments = options.dockerContext ? ['--context', options.dockerContext] : []
  const root = await realpath(options.root)
  if (root.includes(',') || root.includes(':') || /[\r\n]/u.test(root)
    || !options.outputDirectory || isAbsolute(options.outputDirectory) || options.outputDirectory.includes('\\') || options.outputDirectory.includes(':') || options.outputDirectory.includes(',')
    || options.outputDirectory.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))) {
    throw new Error('AUDIO_CONTAINER_PATH_INVALID')
  }
  const output = resolve(root, options.outputDirectory)
  let parent = root
  for (const part of options.outputDirectory.split('/')) {
    const target = resolve(parent, part)
    await mkdir(target).catch((error) => {
      if (error.code !== 'EEXIST')
        throw error
    })
    parent = await realpath(target)
    const path = relative(root, parent)
    if (isAbsolute(path) || path === '..' || path.startsWith('../'))
      throw new Error('AUDIO_CONTAINER_PATH_INVALID')
  }
  const execute = options.execute ?? runAudioProcess
  let inspected: Promise<void> | undefined
  return async (command, args, signal) => {
    signal?.throwIfAborted()
    if (!['ffmpeg', 'ffprobe'].includes(command))
      throw new Error('AUDIO_CONTAINER_COMMAND_INVALID')
    const mapped = args.map((argument) => {
      if (!isAbsolute(argument))
        return argument
      const path = relative(root, argument)
      if (isAbsolute(path) || path === '..' || path.startsWith('../') || path.split('/').some(part => ['.git', 'node_modules'].includes(part.toLowerCase())))
        throw new Error('AUDIO_CONTAINER_PATH_INVALID')
      return `/project/${path}`
    })
    inspected ??= execute('docker', [...dockerArguments, 'image', 'inspect', profile.workerImageDigest, '--format', '{{.Id}}'], signal).then((result) => {
      if (result.stdout.trim() !== profile.workerImageDigest)
        throw new Error('AUDIO_CONTAINER_IMAGE_MISMATCH')
    }).catch((error) => {
      inspected = undefined
      throw error
    })
    await inspected
    signal?.throwIfAborted()
    return await execute('docker', [
      ...dockerArguments,
      'run',
      '--rm',
      '--init',
      '--pull=never',
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--pids-limit=128',
      '--memory=2g',
      '--cpus=2',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=67108864',
      ...(process.getuid && process.getgid ? ['--user', `${process.getuid()}:${process.getgid()}`] : []),
      '--mount',
      `type=bind,source=${root},target=/project,readonly`,
      '--mount',
      `type=bind,source=${output},target=/project/${options.outputDirectory}`,
      '--entrypoint',
      command,
      profile.workerImageDigest,
      ...mapped,
    ], signal)
  }
}
