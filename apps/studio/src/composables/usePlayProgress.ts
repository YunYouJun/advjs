import { useStorage } from '@vueuse/core'

/**
 * Per-chapter / per-project play progress tracking for Studio Play Tab.
 *
 * Persisted to localStorage so reloads keep visited / history state without
 * relying on Dexie migration churn. Save slots use Dexie separately and embed a
 * frozen snapshot of these fields.
 *
 * History stack is capped at MAX_HISTORY entries to avoid unbounded growth in
 * long playthroughs.
 */
const MAX_HISTORY = 200

interface ChapterProgress {
  visitedOrders: number[]
  history: number[]
}

interface ProjectProgress {
  /** Chapter file path → progress. */
  chapters: Record<string, ChapterProgress>
  /**
   * Legacy Studio CG values. New unlocks are owned by RuntimeGalleryController
   * and use stable IDs declared in gameConfig.gallery.
   */
  unlockedCGs: string[]
}

type ProgressMap = Record<string, ProjectProgress>

const PROGRESS_KEY = 'advjs-studio:play-progress'

const progressMap = useStorage<ProgressMap>(PROGRESS_KEY, {})

function ensureProject(projectId: string): ProjectProgress {
  if (!progressMap.value[projectId])
    progressMap.value[projectId] = { chapters: {}, unlockedCGs: [] }
  return progressMap.value[projectId]
}

function ensureChapter(projectId: string, chapterFile: string): ChapterProgress {
  const proj = ensureProject(projectId)
  if (!proj.chapters[chapterFile])
    proj.chapters[chapterFile] = { visitedOrders: [], history: [] }
  return proj.chapters[chapterFile]
}

export function usePlayProgress(projectId: () => string | undefined) {
  function pid(): string | null {
    return projectId() ?? null
  }

  function getChapter(chapterFile: string): ChapterProgress {
    const id = pid()
    if (!id)
      return { visitedOrders: [], history: [] }
    return ensureChapter(id, chapterFile)
  }

  function markVisit(chapterFile: string, order: number): void {
    const id = pid()
    if (!id || order < 0)
      return
    const ch = ensureChapter(id, chapterFile)
    if (!ch.visitedOrders.includes(order))
      ch.visitedOrders = [...ch.visitedOrders, order]
    const top = ch.history[ch.history.length - 1]
    if (top !== order) {
      const next = [...ch.history, order]
      if (next.length > MAX_HISTORY)
        next.shift()
      ch.history = next
    }
  }

  function isVisited(chapterFile: string, order: number): boolean {
    return getChapter(chapterFile).visitedOrders.includes(order)
  }

  function rollback(chapterFile: string, steps = 1): number | null {
    const id = pid()
    if (!id || steps < 1)
      return null
    const ch = ensureChapter(id, chapterFile)
    if (ch.history.length === 0)
      return null
    const popCount = Math.min(steps, ch.history.length)
    const next = ch.history.slice(0, ch.history.length - popCount)
    ch.history = next
    return next.length > 0 ? next[next.length - 1] : 0
  }

  function resetChapter(chapterFile: string): void {
    const id = pid()
    if (!id)
      return
    const proj = ensureProject(id)
    delete proj.chapters[chapterFile]
  }

  function resetProject(): void {
    const id = pid()
    if (!id)
      return
    delete progressMap.value[id]
  }

  /** Hydrate progress from a save-slot snapshot. Replaces chapter + appends CGs. */
  function hydrate(chapterFile: string, snapshot: { visitedOrders: number[], history: number[], unlockedCGs: string[] }): void {
    const id = pid()
    if (!id)
      return
    const proj = ensureProject(id)
    proj.chapters[chapterFile] = {
      visitedOrders: [...snapshot.visitedOrders],
      history: [...snapshot.history],
    }
    for (const cg of snapshot.unlockedCGs) {
      if (!proj.unlockedCGs.includes(cg))
        proj.unlockedCGs.push(cg)
    }
  }

  return {
    getChapter,
    markVisit,
    isVisited,
    rollback,
    resetChapter,
    resetProject,
    hydrate,
  }
}
