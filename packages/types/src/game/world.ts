/** Day period within the game world */
export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

/** World clock state */
export interface WorldClockState {
  /** In-world date (YYYY-MM-DD) */
  date: string
  /** Current day period */
  period: DayPeriod
  /** Weather description */
  weather?: string
  /** Whether the clock is running */
  running: boolean
  /** Time scale: real milliseconds per world hour, default 300000 (5 min) */
  timeScale: number
  /** Real timestamp of last tick */
  lastTickAt?: number
}

/** World event entry */
export interface WorldEvent {
  /** Unique ID */
  id: string
  /** In-world date when the event occurred */
  date: string
  /** Day period when the event occurred */
  period: DayPeriod
  /** Event summary text */
  summary: string
  /** Event type */
  type: 'daily' | 'social' | 'unexpected' | 'weather' | 'manual'
  /** Character IDs involved in this event */
  characterIds?: string[]
  /** Real timestamp */
  timestamp: number
}
