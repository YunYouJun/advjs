import type { DayPeriod, WorldClockState } from '@advjs/types'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'advjs-studio-world-clock'

const PERIOD_ORDER: DayPeriod[] = ['morning', 'afternoon', 'evening', 'night']

const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: '早晨',
  afternoon: '下午',
  evening: '傍晚',
  night: '夜晚',
}

const PERIOD_EMOJI: Record<DayPeriod, string> = {
  morning: '🌅',
  afternoon: '🌞',
  evening: '🌆',
  night: '🌙',
}

function getTodayDate(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function createDefaultClock(): WorldClockState {
  return {
    date: getTodayDate(),
    period: 'morning',
    running: false,
    timeScale: 300000, // 5 minutes = 1 world hour
  }
}

/**
 * Advance date by 1 day in YYYY-MM-DD format.
 */
function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export const useWorldClockStore = defineStore('worldClock', () => {
  const clock = ref<WorldClockState>(createDefaultClock())
  let tickInterval: ReturnType<typeof setInterval> | null = null

  // Listeners that get called on each time advance
  const onAdvanceListeners: Array<(dateChanged: boolean) => void> = []

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as WorldClockState
        // Restore but always start paused
        clock.value = { ...parsed, running: false }
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clock.value))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(clock, () => {
    saveToStorage()
  }, { deep: true })

  /**
   * Register a listener called each time the clock advances.
   * The callback receives whether the date changed (for weather updates).
   */
  function onAdvance(cb: (dateChanged: boolean) => void) {
    onAdvanceListeners.push(cb)
  }

  /**
   * Remove a previously registered advance listener.
   */
  function offAdvance(cb: (dateChanged: boolean) => void) {
    const idx = onAdvanceListeners.indexOf(cb)
    if (idx >= 0)
      onAdvanceListeners.splice(idx, 1)
  }

  /**
   * Advance time by one period.
   * morning → afternoon → evening → night → next day morning
   */
  function advanceTime() {
    const currentIndex = PERIOD_ORDER.indexOf(clock.value.period)
    let dateChanged = false

    if (currentIndex < PERIOD_ORDER.length - 1) {
      clock.value.period = PERIOD_ORDER[currentIndex + 1]
    }
    else {
      // Night → next day morning
      clock.value.date = nextDate(clock.value.date)
      clock.value.period = 'morning'
      dateChanged = true
    }

    clock.value.lastTickAt = Date.now()

    // Notify listeners
    for (const cb of onAdvanceListeners) {
      try {
        cb(dateChanged)
      }
      catch {
        // listener errors shouldn't break the clock
      }
    }
  }

  /**
   * Start the world clock (auto-advance by interval).
   */
  function start() {
    if (clock.value.running)
      return
    clock.value.running = true
    clock.value.lastTickAt = Date.now()
    tickInterval = setInterval(() => {
      advanceTime()
    }, clock.value.timeScale)
  }

  /**
   * Pause the world clock.
   */
  function pause() {
    clock.value.running = false
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  /**
   * Set weather (called by event store after AI generation).
   */
  function setWeather(weather: string) {
    clock.value.weather = weather
  }

  /**
   * Format clock state for system prompt injection.
   */
  function formatClockForPrompt(): string {
    const periodLabel = PERIOD_LABELS[clock.value.period]
    const weather = clock.value.weather ? `，天气：${clock.value.weather}` : ''
    return `# 当前世界时间\n\n${clock.value.date} ${periodLabel}${weather}`
  }

  /**
   * Get period emoji.
   */
  function getPeriodEmoji(): string {
    return PERIOD_EMOJI[clock.value.period]
  }

  /**
   * Get period label.
   */
  function getPeriodLabel(): string {
    return PERIOD_LABELS[clock.value.period]
  }

  /**
   * Reset clock to defaults.
   */
  function reset() {
    pause()
    clock.value = createDefaultClock()
  }

  return {
    clock,
    start,
    pause,
    advanceTime,
    setWeather,
    formatClockForPrompt,
    getPeriodEmoji,
    getPeriodLabel,
    onAdvance,
    offAdvance,
    reset,
  }
})
