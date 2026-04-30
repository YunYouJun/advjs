/**
 * useProjectImport — Phase M10 Source-to-Project orchestrator.
 *
 * Binds the pure `projectGenerator.generateProject()` stream of
 * `GenerateProgressEvent` into Vue reactive state so the import wizard
 * (`ImportSourcePage` + friends) can render:
 *   • a left-side progress tree (steps + per-step children + status)
 *   • a right-side streaming preview of generated files
 *   • completion actions (Play / Edit / Export .advpkg)
 *
 * UI-agnostic: returns refs and methods only, no template bindings and no
 * toast/router calls — the caller (page) owns presentation. Keeping this
 * pure makes the composable easily unit-testable with an `AiBridge` mock
 * and reusable for future flows (e.g. "regenerate one chapter only").
 *
 * State machine:
 *
 *   idle → parsing → generating → previewing → writing → done
 *                 ↘        ↘          ↘          ↘
 *                  error    error      (user)     error
 *
 * `previewing` is the state where the user inspects generated files and
 * decides whether to confirm (→ writing) or discard. If any step emits an
 * `errorRecoverable:true` event we still reach `previewing`, just with
 * `draftMode=true` so the UI can relabel the confirm button.
 */

import type { IFileSystem } from '../utils/fs'
import type {
  AiBridge,
  GenerateProgressEvent,
  GenerateResult,
  GenerateStats,
  GenerationStep,
} from '../utils/projectGenerator'
import type { TemplateFile } from '../utils/projectTemplate'
import type { NormalizedSource, SourceParseInput } from '../utils/sourceParser'
import type { TemplateDef } from '../utils/templates/loadTemplate'
import { computed, reactive, ref, shallowRef } from 'vue'
import { generateProject } from '../utils/projectGenerator'
import { writeTemplateFiles } from '../utils/projectTemplate'
import { parseSource } from '../utils/sourceParser'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ImportStatus
  = | 'idle'
    | 'parsing'
    | 'generating'
    | 'previewing'
    | 'writing'
    | 'done'
    | 'error'

/**
 * Per-step progress node rendered in ProgressTree. Children is the stable
 * per-step enumeration (characters → list of character names as they arrive,
 * chapters → list of chapter titles, etc.).
 */
export interface ProgressNode {
  key: GenerationStep
  label: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  message?: string
  children: Array<{ label: string, status: 'complete' | 'failed' }>
}

export interface ImportStartParams {
  /** Parsed/normalized source doc. */
  source: NormalizedSource
  /** Resolved template. */
  template: TemplateDef
  /** Human-readable project name (becomes README title). */
  projectName: string
  /** Slug used as project directory + projectId. */
  projectSlug: string
  /**
   * Optional AI transport override. In production omitted — `projectGenerator`
   * falls back to the real `useAiSettingsStore` + `streamChat`. Tests pass a
   * scripted bridge here to avoid the Pinia + network path.
   */
  aiBridge?: AiBridge
}

/**
 * Write-confirmation parameters. Caller supplies an `IFileSystem` adapter
 * that has already been scoped to the *target* project directory.
 *
 * Decoupled from directory creation: the page layer chooses whether to
 * prompt the user to pick a parent dir (Browser FS API) or reuse the
 * current project (Capacitor).
 */
export interface ImportWriteParams {
  fs: IFileSystem
}

// ---------------------------------------------------------------------------
// Step metadata (labels are plain text; page translates via t() on display)
// ---------------------------------------------------------------------------

const STEP_ORDER: GenerationStep[] = ['characters', 'chapters', 'scenes', 'knowledge']

function emptyProgressTree(): Record<GenerationStep, ProgressNode> {
  return {
    characters: { key: 'characters', label: 'characters', status: 'pending', children: [] },
    chapters: { key: 'chapters', label: 'chapters', status: 'pending', children: [] },
    scenes: { key: 'scenes', label: 'scenes', status: 'pending', children: [] },
    knowledge: { key: 'knowledge', label: 'knowledge', status: 'pending', children: [] },
    // 'done' is a terminal marker, not rendered in the tree.
    done: { key: 'done', label: 'done', status: 'pending', children: [] },
  }
}

// ---------------------------------------------------------------------------
// The composable
// ---------------------------------------------------------------------------

export function useProjectImport() {
  // -------- Reactive state --------
  const status = ref<ImportStatus>('idle')
  const currentStep = ref<GenerationStep | null>(null)
  /** Pretty error (message + recoverability). `error.recoverable` false means the run is finished. */
  const error = ref<{ step: GenerationStep | null, message: string, recoverable: boolean } | null>(null)

  /** Monotonic file list coming from `GenerateProgressEvent.partialFiles`. Use shallowRef for cheap re-render. */
  const previewFiles = shallowRef<TemplateFile[]>([])

  /** One ProgressNode per step, mutated in place as events arrive. */
  const progressTree = reactive<Record<GenerationStep, ProgressNode>>(emptyProgressTree())

  /** Final stats after generation completes. */
  const stats = shallowRef<GenerateStats | null>(null)
  /** True if any step ended in `errorRecoverable` but generation ran to completion. */
  const draftMode = ref(false)
  /** Steps that failed irrecoverably-within-step but allowed the run to continue. */
  const failedSteps = shallowRef<GenerationStep[]>([])

  /** Input source parsed in `startParse()`, kept for retry/inspection. */
  const parsedSource = shallowRef<NormalizedSource | null>(null)

  // -------- AbortController for current generation --------
  let activeAbort: AbortController | null = null

  /** Params snapshot so retryCurrentStep can re-invoke without caller help. */
  let lastGenerateParams: ImportStartParams | null = null

  // -------- Derived helpers --------
  const isBusy = computed(
    () => status.value === 'parsing' || status.value === 'generating' || status.value === 'writing',
  )
  const canConfirm = computed(() => status.value === 'previewing' && previewFiles.value.length > 0)
  const visibleProgressNodes = computed<ProgressNode[]>(
    () => STEP_ORDER.map(k => progressTree[k]),
  )

  // -------- Internal: event → state reducer --------
  function applyEvent(e: GenerateProgressEvent) {
    // 'done' is the terminal marker — no progress-tree change needed.
    if (e.step === 'done') {
      if (e.partialFiles)
        previewFiles.value = e.partialFiles
      return
    }

    const node = progressTree[e.step]
    currentStep.value = e.step

    if (e.phase === 'start') {
      node.status = 'running'
      node.message = e.message
    }
    else if (e.phase === 'chunk') {
      node.status = 'running'
      node.message = e.message
      // Derive a child label from the chunk message when possible (chapter/scene milestones).
      // We keep this simple — the Pipeline emits human-readable messages so we surface them verbatim.
      node.children.push({ label: e.message, status: 'complete' })
    }
    else if (e.phase === 'complete') {
      node.status = 'complete'
      node.message = e.message
    }
    else if (e.phase === 'error') {
      node.status = 'failed'
      node.message = e.message
      if (!e.errorRecoverable) {
        error.value = { step: e.step, message: e.message, recoverable: false }
      }
    }

    if (e.partialFiles)
      previewFiles.value = e.partialFiles
  }

  // -------- Step 1: parse source --------
  /**
   * Normalize raw source material. Kept separate from `startGenerate` so the
   * UI can show a parse-only step first (useful for large PDFs in W3+ where
   * parsing is observably slow).
   */
  async function startParse(input: SourceParseInput): Promise<NormalizedSource> {
    reset()
    status.value = 'parsing'
    try {
      const source = await parseSource(input)
      parsedSource.value = source
      status.value = 'idle' // caller must now pick template and call startGenerate
      return source
    }
    catch (err) {
      status.value = 'error'
      error.value = {
        step: null,
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      }
      throw err
    }
  }

  // -------- Step 2: generate project --------
  /**
   * Kick off the 4-step LLM pipeline. Safe to call only once per instance —
   * call `reset()` first to re-run.
   */
  async function startGenerate(params: ImportStartParams): Promise<GenerateResult> {
    if (status.value === 'generating') {
      throw new Error('[useProjectImport] generation already in progress')
    }

    // Reset generation-only state (keep parsedSource around for retries).
    Object.assign(progressTree, emptyProgressTree())
    previewFiles.value = []
    stats.value = null
    draftMode.value = false
    failedSteps.value = []
    error.value = null
    currentStep.value = null

    activeAbort = new AbortController()
    status.value = 'generating'
    lastGenerateParams = params

    try {
      const result = await generateProject({
        source: params.source,
        template: params.template,
        projectName: params.projectName,
        projectSlug: params.projectSlug,
        signal: activeAbort.signal,
        onProgress: applyEvent,
        aiBridge: params.aiBridge,
      })

      stats.value = result.stats
      draftMode.value = result.draftMode
      failedSteps.value = result.failedSteps
      previewFiles.value = result.files
      status.value = 'previewing'
      return result
    }
    catch (err) {
      // AbortError is an expected cancel, not an error-to-report.
      if ((err as DOMException)?.name === 'AbortError') {
        status.value = 'idle'
        throw err
      }
      status.value = 'error'
      if (!error.value) {
        error.value = {
          step: currentStep.value,
          message: err instanceof Error ? err.message : String(err),
          recoverable: false,
        }
      }
      throw err
    }
    finally {
      activeAbort = null
    }
  }

  // -------- Step 3: confirm + write to fs --------
  /**
   * Persist `previewFiles` into the given file system. The caller is
   * responsible for creating the target directory and for switching the
   * studio project *after* this resolves (we don't depend on the studio
   * store here to keep the composable pure).
   */
  async function confirmWrite(params: ImportWriteParams): Promise<void> {
    if (!canConfirm.value)
      throw new Error('[useProjectImport] nothing to confirm — generation not in previewing state')

    status.value = 'writing'
    try {
      await writeTemplateFiles(params.fs, previewFiles.value)
      status.value = 'done'
    }
    catch (err) {
      status.value = 'error'
      error.value = {
        step: null,
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      }
      throw err
    }
  }

  // -------- Retry: keep results from completed steps, re-run from failure ----

  /**
   * Re-run the pipeline from the **first failed step** onward, keeping all
   * files that were already generated by prior successful steps.
   *
   * Only callable when `status === 'error'` or `status === 'previewing'` with
   * `draftMode === true` (i.e. the pipeline hit a recoverable failure).
   *
   * Under the hood we call `generateProject` with `resumeAfter` set to the
   * steps that already succeeded — the generator skips those and picks up from
   * the first un-finished / failed step.
   */
  async function retryCurrentStep(): Promise<void> {
    if (!lastGenerateParams)
      throw new Error('[useProjectImport] no previous generation to retry — call startGenerate first')

    if (status.value !== 'error' && !(status.value === 'previewing' && draftMode.value))
      throw new Error('[useProjectImport] retryCurrentStep only available after a failure')

    // Determine which steps already succeeded — we'll keep their files.
    const completedSteps = STEP_ORDER.filter(k => progressTree[k].status === 'complete')

    // Reset only the progress nodes for failed/pending steps.
    for (const k of STEP_ORDER) {
      if (progressTree[k].status !== 'complete') {
        progressTree[k].status = 'pending'
        progressTree[k].message = undefined
        progressTree[k].children = []
      }
    }
    error.value = null
    failedSteps.value = []
    draftMode.value = false

    // Keep files produced by completed steps, discard those from failed steps.
    const keptFiles = previewFiles.value.filter((f) => {
      if (f.path.startsWith('adv/characters/'))
        return completedSteps.includes('characters')
      if (f.path.startsWith('adv/chapters/'))
        return completedSteps.includes('chapters')
      if (f.path.startsWith('adv/scenes/') || f.path.startsWith('adv/locations/'))
        return completedSteps.includes('scenes')
      if (f.path.startsWith('adv/knowledge/'))
        return completedSteps.includes('knowledge')
      // Boilerplate files (README, world, outline, import-log) are regenerated.
      return false
    })

    activeAbort = new AbortController()
    status.value = 'generating'

    try {
      const result = await generateProject({
        source: lastGenerateParams.source,
        template: lastGenerateParams.template,
        projectName: lastGenerateParams.projectName,
        projectSlug: lastGenerateParams.projectSlug,
        signal: activeAbort.signal,
        onProgress: applyEvent,
        aiBridge: lastGenerateParams.aiBridge,
        resumeAfter: completedSteps,
        existingFiles: keptFiles,
      })

      stats.value = result.stats
      draftMode.value = result.draftMode
      failedSteps.value = result.failedSteps
      previewFiles.value = result.files
      status.value = 'previewing'
    }
    catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        status.value = 'idle'
        throw err
      }
      status.value = 'error'
      if (!error.value) {
        error.value = {
          step: currentStep.value,
          message: err instanceof Error ? err.message : String(err),
          recoverable: false,
        }
      }
      throw err
    }
    finally {
      activeAbort = null
    }
  }

  // -------- Control --------
  /** Cancel any in-flight generation. Safe to call in any state. */
  function abort(): void {
    activeAbort?.abort()
    activeAbort = null
    if (status.value === 'generating' || status.value === 'parsing') {
      status.value = 'idle'
    }
  }

  /** Reset all state back to `idle`. Does not abort an in-flight run — call `abort()` first. */
  function reset(): void {
    status.value = 'idle'
    currentStep.value = null
    error.value = null
    previewFiles.value = []
    Object.assign(progressTree, emptyProgressTree())
    stats.value = null
    draftMode.value = false
    failedSteps.value = []
    parsedSource.value = null
    lastGenerateParams = null
  }

  return {
    // state
    status,
    currentStep,
    error,
    previewFiles,
    progressTree,
    visibleProgressNodes,
    stats,
    draftMode,
    failedSteps,
    parsedSource,

    // derived
    isBusy,
    canConfirm,

    // actions
    startParse,
    startGenerate,
    confirmWrite,
    retryCurrentStep,
    abort,
    reset,
  }
}

export type UseProjectImportReturn = ReturnType<typeof useProjectImport>
