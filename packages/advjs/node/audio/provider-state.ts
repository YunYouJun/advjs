import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'pathe'
import { atomicProjectWrite, projectWriteTarget } from '../editor/mutations'

const coordinate = '.advjs/voice/provider-state.json'
export async function readVoiceProviderState(root: string): Promise<string[]> {
  const file = await realpath(resolve(root, coordinate)).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
  if (!file)
    return []
  const path = relative(root, file)
  if (isAbsolute(path) || path === '..' || path.startsWith('../') || (await stat(file)).size > 64 * 1024)
    throw new Error('VOICE_PROVIDER_STATE_INVALID')
  const value = JSON.parse(await readFile(file, 'utf8'))
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || !Array.isArray(value.disabled) || value.disabled.some((id: unknown) => typeof id !== 'string' || !/^[a-z][\w.-]{0,127}$/u.test(id)))
    throw new Error('VOICE_PROVIDER_STATE_INVALID')
  return value.disabled
}

export async function setVoiceProviderEnabled(root: string, providerId: string, enabled: boolean) {
  const disabled = new Set(await readVoiceProviderState(root))
  if (enabled)
    disabled.delete(providerId)
  else
    disabled.add(providerId)
  await atomicProjectWrite(await projectWriteTarget(root, coordinate), `${JSON.stringify({ schemaVersion: 1, disabled: [...disabled].sort() }, null, 2)}\n`)
}
