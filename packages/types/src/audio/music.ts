/** Author intent stays in the native catalog; all musical uses play on the music bus. */
export type AdvMusicUsage = 'background' | 'theme' | 'opening' | 'ending' | 'insert'

export interface AdvMusicBrief {
  summary: string
  mood?: string
  style?: string
  /** A creation target, never a substitute for measured media duration. */
  durationSeconds?: number
  tempoBpm?: number
  instrumental?: boolean
  loopIntent?: boolean
  notes?: string
}

export interface AdvMusicMetadata {
  schemaVersion: 1
  usage: AdvMusicUsage
  source: {
    type: 'manual' | 'external-ai'
    tool?: string
    /** Public provenance page only. Never used as the playback transport. */
    url?: string
  }
  brief?: AdvMusicBrief
  rights?: {
    license: string
    credit?: string
    permissionNote?: string
  }
  review: {
    status: 'pending' | 'approved' | 'rejected'
    /** Explicit review is bound to the immutable imported master. */
    sha256?: string
    reviewedAt?: string
  }
}
