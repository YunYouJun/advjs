import type { AdvVoiceContext } from '../config/voice'

export type VoiceResourceKind = 'cache' | 'environment' | 'model'

/** Trusted Node registration, never accepted from a browser or project JSON. */
export interface VoiceManagedInstallation {
  root: string
  id: string
  protectedPaths: string[]
  resources: Array<{ id: string, label: string, kind: VoiceResourceKind, path: string, sharedWith?: string[] }>
  isRunning?: () => Promise<boolean>
  stop?: (context: AdvVoiceContext) => Promise<void>
}

export interface VoiceResourceInfo {
  id: string
  label: string
  kind: VoiceResourceKind
  location: string
  bytes: number
  allocatedBytes: number
  sharedWith: string[]
  available: boolean
  blockedReason?: string
}

export interface VoiceProviderMaintenanceSnapshot {
  providers: Array<{ id: string, enabled: boolean, managed: boolean, running: boolean, canStop: boolean, resources: VoiceResourceInfo[] }>
}

export interface VoiceCleanupSelection {
  providerId: string
  resourceIds: string[]
  allowShared: boolean
}

export interface VoiceCleanupPlan extends VoiceCleanupSelection {
  id: string
  hash: string
  expiresAt: string
  resources: VoiceResourceInfo[]
  totalBytes: number
  preserved: string[]
  packageRemovalCommand: string
}

export interface VoiceCleanupResult {
  providerId: string
  disabled: boolean
  removed: string[]
  removedBytes: number
  availableSpaceDelta: number
  packageRemoved: false
}

export interface VoiceProviderMaintenancePort {
  read: (signal?: AbortSignal) => Promise<VoiceProviderMaintenanceSnapshot>
  plan: (input: VoiceCleanupSelection, signal?: AbortSignal) => Promise<VoiceCleanupPlan>
  execute: (input: { id: string, hash: string }, signal?: AbortSignal) => Promise<VoiceCleanupResult>
  stop: (providerId: string, signal?: AbortSignal) => Promise<void>
  enable: (providerId: string, signal?: AbortSignal) => Promise<void>
}
