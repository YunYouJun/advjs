import type { CompileDiagnostic, CompileSourceLocation } from '../compiler/types'

const slots = new Set(['bed', 'weather', 'crowd', 'detail'])
const assetPattern = /^\w[\w./-]*$/u

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** Validate JSON operations at the shared linker seam, including serialized Flow input. */
export function validateAudioOperation(
  operation: unknown,
  diagnostics: CompileDiagnostic[],
  source?: CompileSourceLocation,
): void {
  if (!record(operation) || !['bgm', 'ambience', 'sfx', 'voice', 'ui', 'audio'].includes(String(operation.type)))
    return
  const fail = (code: string, message: string) => diagnostics.push({ code, severity: 'error', message, source })
  if (['voice', 'ui', 'audio'].includes(String(operation.type))) {
    fail('ADV_AUDIO_UNSUPPORTED_OPERATION', 'Dialogue voice resolves through the ledger and UI audio uses semantic cues; script audio requires bgm, ambience or sfx operations')
    return
  }
  if (['name', 'src', 'bgmSrc', 'stop', 'url'].some(key => key in operation)) {
    fail('ADV_AUDIO_LEGACY_OPERATION', 'Audio operations require explicit action and native asset IDs; migrate name, src, URL and stop fields before compiling')
  }
  const action = operation.action
  const sfx = operation.type === 'sfx'
  const allowed = new Set(['type', 'id', 'when', 'action', 'asset', 'gain', ...sfx ? ['group', 'priority'] : ['loop', 'fade'], ...operation.type === 'ambience' ? ['slot'] : []])
  if (Object.keys(operation).some(key => !allowed.has(key) && !['name', 'src', 'bgmSrc', 'stop', 'url'].includes(key)))
    fail('ADV_AUDIO_UNKNOWN_FIELD', 'Audio operation contains fields outside its canonical protocol')
  if (sfx ? action !== 'play' : action !== 'set' && action !== 'clear')
    fail('ADV_AUDIO_INVALID_ACTION', `${String(operation.type)} requires ${sfx ? 'action: play' : 'action: set or clear'}`)
  if (sfx || action === 'set') {
    if (typeof operation.asset !== 'string' || !assetPattern.test(operation.asset) || operation.asset.split('/').some(segment => !segment || segment === '.' || segment === '..'))
      fail('ADV_AUDIO_INVALID_ASSET', 'Audio playback requires a native Asset Catalog ID, not a path or URL')
  }
  else if (action === 'clear' && operation.asset !== undefined) {
    fail('ADV_AUDIO_INVALID_ASSET', 'A clear operation must not name an asset')
  }
  if (operation.type === 'ambience' && !slots.has(String(operation.slot)))
    fail('ADV_AUDIO_INVALID_SLOT', 'Ambience slot must be bed, weather, crowd or detail')
  if (operation.gain !== undefined && (typeof operation.gain !== 'number' || !Number.isFinite(operation.gain) || operation.gain < 0 || operation.gain > 1))
    fail('ADV_AUDIO_INVALID_GAIN', 'Audio gain must be a finite number between 0 and 1')
  if (operation.loop !== undefined && (sfx || typeof operation.loop !== 'boolean'))
    fail('ADV_AUDIO_INVALID_LOOP', 'Loop is a boolean option for persistent BGM or ambience only')
  if (operation.fade !== undefined) {
    if (sfx || !record(operation.fade) || Object.keys(operation.fade).some(key => !['in', 'out'].includes(key))) {
      fail('ADV_AUDIO_INVALID_FADE', 'Persistent audio fade accepts only in and out millisecond values')
    }
    else {
      if (action === 'clear' && operation.fade.in !== undefined)
        fail('ADV_AUDIO_INVALID_FADE', 'An audio clear operation supports fade out only')
      for (const value of Object.values(operation.fade)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 60_000) {
          fail('ADV_AUDIO_INVALID_FADE', 'Audio fade timings must be finite milliseconds between 0 and 60000')
          break
        }
      }
    }
  }
  if (operation.group !== undefined && (!sfx || typeof operation.group !== 'string' || !assetPattern.test(operation.group)))
    fail('ADV_AUDIO_INVALID_GROUP', 'SFX group must be a stable identifier')
  if (operation.priority !== undefined && (!sfx || typeof operation.priority !== 'number' || !Number.isFinite(operation.priority)))
    fail('ADV_AUDIO_INVALID_PRIORITY', 'SFX priority must be a finite number')
}
