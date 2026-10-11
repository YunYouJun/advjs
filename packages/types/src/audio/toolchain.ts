export interface AudioToolchainLock {
  schemaVersion: 1
  profileId: string
  ffmpegBuildFingerprint: string
  workerImageDigest: string
}

export interface AudioApprovedToolchainProfile {
  id: string
  ffmpegBuildFingerprint: string
  workerImageDigest: string
}

export interface AudioMediaMetadata {
  sha256: string
  bytes: number
  mimeType: string
  codec: string
  duration: number
  sampleRate: number
  channels: number
  /** EBU R128 cannot measure an integrated level for very short cues. */
  integratedLufs: number | null
  truePeakDb: number
}

export interface AudioProcessingReceipt {
  schemaVersion: 1
  purpose: 'preview' | 'release'
  presetId: string
  masterSha256: string
  ffmpegBuildFingerprint: string
  toolchain?: AudioToolchainLock
  outputs: Array<{ variant: 'opus' | 'aac', path: string, metadata: AudioMediaMetadata }>
}
