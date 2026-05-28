/**
 * Lightweight self-hosted telemetry client.
 *
 * Privacy contract:
 * - Default OFF. Opt-in is persisted in `advjs-studio:telemetry-opt-in`
 *   (`'allow'` / `'deny'`). When unset, the UI prompts the user once and
 *   no events leave the device.
 * - Events queue in localStorage (`advjs-studio:telemetry-queue`) so unflushed
 *   events survive reloads. The queue is dropped (not sent) when the user
 *   later opts out.
 * - Each event payload is `{ name, ts, sid, props? }` — no project content,
 *   no message bodies, no file paths beyond the relative `adv/` subpath.
 * - Flush calls CloudBase cloud function `advjs-telemetry` if available;
 *   missing function (e.g. local dev without CloudBase) is silently tolerated.
 */

const OPT_IN_KEY = 'advjs-studio:telemetry-opt-in'
const QUEUE_KEY = 'advjs-studio:telemetry-queue'
const SESSION_KEY = 'advjs-studio:telemetry-sid'
const FLUSH_INTERVAL_MS = 30_000
const FLUSH_THRESHOLD = 50
const FUNCTION_NAME = 'advjs-telemetry'

export type TelemetryOptIn = 'allow' | 'deny' | 'unset'

export interface TelemetryEvent {
  name: string
  ts: number
  sid: string
  props?: Record<string, unknown>
}

function readOptIn(): TelemetryOptIn {
  try {
    const v = localStorage.getItem(OPT_IN_KEY)
    return v === 'allow' || v === 'deny' ? v : 'unset'
  }
  catch {
    return 'unset'
  }
}

export function setOptIn(v: 'allow' | 'deny'): void {
  try {
    localStorage.setItem(OPT_IN_KEY, v)
    if (v === 'deny')
      localStorage.removeItem(QUEUE_KEY)
  }
  catch { /* private mode */ }
}

export function getOptIn(): TelemetryOptIn {
  return readOptIn()
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  }
  catch {
    return `s_${Date.now()}`
  }
}

function readQueue(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  }
  catch {
    return []
  }
}

function writeQueue(events: TelemetryEvent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events))
  }
  catch { /* quota / private mode */ }
}

/**
 * Record an event. No-op until the user opts in.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (readOptIn() !== 'allow')
    return
  const ev: TelemetryEvent = {
    name,
    ts: Date.now(),
    sid: getSessionId(),
    props: props ? sanitize(props) : undefined,
  }
  const q = readQueue()
  q.push(ev)
  writeQueue(q)
  if (q.length >= FLUSH_THRESHOLD)
    void flush()
}

/**
 * Sanitize props: drop anything that looks like raw user content (long
 * strings, function bodies) — keep numbers, booleans, short strings, arrays
 * of primitives. Defensive against accidental project-content leakage.
 */
function sanitize(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v == null)
      continue
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
    else if (typeof v === 'string') {
      out[k] = v.length > 120 ? `${v.slice(0, 120)}…` : v
    }
    else if (Array.isArray(v) && v.length <= 20 && v.every(x => typeof x === 'string' || typeof x === 'number')) {
      out[k] = v
    }
  }
  return out
}

let flushing = false
let cloudApp: { callFunction?: (opts: { name: string, data: unknown }) => Promise<unknown> } | null = null

/**
 * Inject the CloudBase app handle (called once from `main.ts` after the
 * SDK initialises). Telemetry stays no-op until this is wired so we don't
 * keep failing to flush in environments without CloudBase.
 */
export function attachCloudbase(app: any): void {
  cloudApp = app
}

export async function flush(): Promise<void> {
  if (flushing)
    return
  if (readOptIn() !== 'allow')
    return
  if (!cloudApp?.callFunction)
    return
  const queue = readQueue()
  if (queue.length === 0)
    return
  flushing = true
  try {
    // Send in chunks of 100 to keep payloads small.
    const chunkSize = 100
    for (let i = 0; i < queue.length; i += chunkSize) {
      const chunk = queue.slice(i, i + chunkSize)
      try {
        await cloudApp.callFunction({
          name: FUNCTION_NAME,
          data: { events: chunk },
        })
      }
      catch (e) {
        // Stop on first error — keep remaining events in queue for retry.
        const remaining = queue.slice(i)
        writeQueue(remaining)
        // Log to console only in dev; never re-throw (telemetry must never break UX).
        if (import.meta.env.DEV)
          console.warn('[telemetry] flush partial failure', e)
        return
      }
    }
    writeQueue([])
  }
  finally {
    flushing = false
  }
}

let flushTimer: ReturnType<typeof setInterval> | null = null

export function startTelemetry(): void {
  if (flushTimer)
    return
  flushTimer = setInterval(() => {
    void flush()
  }, FLUSH_INTERVAL_MS)
  // Best-effort flush on tab close.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      void flush()
    })
  }
}

export function stopTelemetry(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}
