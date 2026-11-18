import type { AdvVoiceCapabilities, AdvVoiceDoctorResult } from '../config/voice'

/** Project registration metadata, without credentials, paths, or environment probes. */
export interface VoiceProviderStatusSnapshot {
  configured: boolean
  providers: Array<{
    id: string
    enabled: boolean
    diagnostics: boolean
    capabilities?: AdvVoiceCapabilities
  }>
}

export type VoiceProviderDiagnosisState = 'ready' | 'not-ready' | 'unsupported' | 'unconfigured' | 'disabled' | 'diagnostics-unavailable'

/** A bounded, explicit diagnosis; ready never means an audio quality guarantee. */
export interface VoiceProviderDiagnosis {
  providerId: string
  state: VoiceProviderDiagnosisState
  checkedAt: string
  checks: AdvVoiceDoctorResult['checks']
}

export interface VoiceProviderStatusPort {
  read: (signal?: AbortSignal) => Promise<VoiceProviderStatusSnapshot>
  doctor: (providerId: string, signal?: AbortSignal) => Promise<VoiceProviderDiagnosis>
}
