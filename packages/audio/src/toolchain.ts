import type { AudioApprovedToolchainProfile, AudioToolchainLock } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'

/** Profiles come from the trusted host's allowlist, never from project data. */
export function parseAudioToolchainLock(value: unknown): AudioToolchainLock {
  canonicalAudioJson(value)
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AUDIO_TOOLCHAIN_LOCK_INVALID: Expected a toolchain document')
  const lock = value as Record<string, unknown>
  if (Object.keys(lock).some(key => !['schemaVersion', 'profileId', 'ffmpegBuildFingerprint', 'workerImageDigest'].includes(key))
    || lock.schemaVersion !== 1 || typeof lock.profileId !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/u.test(lock.profileId)
    || typeof lock.ffmpegBuildFingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(lock.ffmpegBuildFingerprint)
    || typeof lock.workerImageDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(lock.workerImageDigest)) {
    throw new Error('AUDIO_TOOLCHAIN_LOCK_INVALID: Invalid schema, profile or build digest')
  }
  return structuredClone(value) as AudioToolchainLock
}

export function assertAudioReleaseToolchain(value: unknown, fingerprint: string, approved: readonly AudioApprovedToolchainProfile[]): AudioToolchainLock {
  const lock = parseAudioToolchainLock(value)
  const profile = approved.find(profile => profile.id === lock.profileId)
  if (!profile || profile.workerImageDigest !== lock.workerImageDigest || profile.ffmpegBuildFingerprint !== lock.ffmpegBuildFingerprint)
    throw new Error('AUDIO_TOOLCHAIN_PROFILE_UNAPPROVED: The trusted host must approve this exact profile and image digest')
  if (fingerprint !== lock.ffmpegBuildFingerprint)
    throw new Error('AUDIO_TOOLCHAIN_BUILD_MISMATCH: This build may produce previews only')
  return lock
}
