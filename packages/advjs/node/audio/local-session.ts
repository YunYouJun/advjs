import type { StudioVoiceServiceOptions } from './server'
import { createHash, timingSafeEqual } from 'node:crypto'

export interface LocalVoiceServiceOptions {
  /** A fresh 32-byte random hex capability, supplied only by the local operator. */
  accessToken: string
  /** ISO timestamp, at most 24 hours from configuration. */
  expiresAt: string
  port?: number
  stateDirectory?: string
  allowedOrigins: string[]
  projects: Array<Omit<StudioVoiceServiceOptions['projects'][number], 'accountId'>>
  publication?: StudioVoiceServiceOptions['publication']
}

/** Local pairing changes only authentication; all native audio routes stay shared. */
export function createLocalVoiceServiceOptions(options: LocalVoiceServiceOptions): StudioVoiceServiceOptions {
  const fail = () => {
    throw new Error('ADV_AUDIO_LOCAL_SESSION_CONFIG_INVALID')
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => !['accessToken', 'expiresAt', 'port', 'stateDirectory', 'allowedOrigins', 'projects', 'publication'].includes(key))
    || typeof options.accessToken !== 'string' || !/^[a-f0-9]{64}$/u.test(options.accessToken)
    || typeof options.expiresAt !== 'string') {
    fail()
  }
  const expiresAt = Date.parse(options.expiresAt)
  const now = Date.now()
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== options.expiresAt || expiresAt <= now || expiresAt - now > 24 * 60 * 60_000)
    fail()
  if (!Array.isArray(options.allowedOrigins) || !options.allowedOrigins.length || !Array.isArray(options.projects) || !options.projects.length)
    fail()
  const allowedOrigins = options.allowedOrigins.map((origin) => {
    try {
      const url = new URL(origin)
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        fail()
    }
    catch { fail() }
    return origin
  })
  const projects = options.projects.map((project) => {
    if (!project || typeof project !== 'object' || Object.keys(project).some(key => !['projectId', 'root', 'config'].includes(key)))
      fail()
    return { ...project, accountId: 'local-device' }
  })
  const digest = createHash('sha256').update(options.accessToken).digest()
  const registered = new Set(projects.map(project => project.projectId))
  return {
    host: '127.0.0.1',
    ...(options.port === undefined ? {} : { port: options.port }),
    ...(options.stateDirectory === undefined ? {} : { stateDirectory: options.stateDirectory }),
    allowedOrigins,
    projects,
    async authenticate(accessToken) {
      if (Date.now() >= expiresAt || typeof accessToken !== 'string' || !/^[a-f0-9]{64}$/u.test(accessToken))
        return undefined
      const candidate = createHash('sha256').update(accessToken).digest()
      return timingSafeEqual(candidate, digest) ? { accountId: 'local-device' } : undefined
    },
    // Queued jobs must also stop dispatching when the pairing expires.
    async authorizeProject(accountId, projectId) {
      return Date.now() < expiresAt && accountId === 'local-device' && registered.has(projectId)
    },
    ...(options.publication ? { publication: options.publication } : {}),
  }
}
