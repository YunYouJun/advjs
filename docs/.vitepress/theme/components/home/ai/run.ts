import type { AdvProjectCompileResult, RuntimeProgram } from '@advjs/types'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { AiApiErrorType, PlayerChoiceAction, SegmentRecord, StoryLocale, StorySession, StoryUsage } from '../../../../../../packages/ai/src'
import type { StoryPlayer } from '../../../composables/player'
import type { Story } from '../data/skins'
import type { SourceLines } from '../data/source-roles'
import { computed, ref, shallowRef, watch } from 'vue'
import { AiApiError, createStorySession } from '../../../../../../packages/ai/src'
import { compileProject } from '../../../../../../packages/core/src/project/compile'
import { parseAst } from '../../../../../../packages/parser/src'
import { mapStoryNodes } from '../data/story-map'
import { highlight } from './highlight'
import { endlessTram } from './modes/endless-tram'
import { endlessTramSample, endlessTramSeed } from './seeds'
import { endpointOf, loadSettings } from './settings'

/**
 * - `starting`: compiling the seed
 * - `playing`: the story is on stage; a finished choice at the newest stop starts `writing`
 * - `writing`: the model is writing the next stop
 * - `error`: the last request failed; `retry()` asks again
 * - `sample`: replaying the pre-generated run, nothing is sent anywhere
 * - `finished`: the passenger got off
 */
export type AiStatus = 'starting' | 'playing' | 'writing' | 'error' | 'sample' | 'finished'

export interface AiError {
  type: AiApiErrorType | 'internal'
  message: string
}

/** The file the model is writing right now, as it streams in. */
export interface AiWriting {
  path: string
  /** 1 for the first try, 2 while it fixes problems the engine found. */
  attempt: number
  /** The stop's name, once its `## ` line has arrived. */
  title?: string
  lines: SourceLines
}

export interface AiStation {
  id: string
  name?: string
}

export interface AiRun {
  status: Ref<AiStatus>
  story: ShallowRef<Story | undefined>
  /** Highlighted files of the run, by project path. */
  tokens: ShallowRef<Record<string, SourceLines>>
  writing: ShallowRef<AiWriting | undefined>
  error: ShallowRef<AiError | undefined>
  segments: ShallowRef<readonly SegmentRecord[]>
  usage: ShallowRef<StoryUsage | undefined>
  /** The departure, then one stop per accepted segment. */
  stations: ComputedRef<AiStation[]>
  /** The stop each chapter belongs to. */
  stationOf: (chapterId: string) => string
  hasSample: boolean
  start: () => Promise<void>
  startSample: () => Promise<void>
  retry: () => Promise<void>
  finish: () => void
  dispose: () => void
}

const STORY_ID = 'endless-tram'
const DEPARTURE = 'start'
const STOP = /^s\d+$/

async function toStory(result: AdvProjectCompileResult, program: RuntimeProgram, files: Record<string, string>): Promise<Story> {
  const { project } = result
  return {
    id: STORY_ID,
    title: String(project.game.title ?? ''),
    program,
    variables: (project.game.variables ?? {}) as Story['variables'],
    chapters: project.chapters.map(({ id, sources }) => ({ id, sources })),
    files: Object.keys(files).sort(),
    nodes: await mapStoryNodes({ chapters: project.chapters, files, program, parseAst }),
  }
}

/** The stop's name from a reply in progress: its `## ` line, without an anchor. */
function titleOf(text: string): string | undefined {
  const line = text.match(/^##[ \t](.*)$/m)?.[1]
  return line?.trim().replace(/\{#[^}]*\}$/, '').trim() || undefined
}

/**
 * Lines of a reply as it streams: highlighted up to the last line that finished highlighting,
 * plain text after it, so nothing waits on the highlighter.
 */
function streamingView(path: string, onLines: (lines: SourceLines) => void) {
  let text = ''
  let done: SourceLines = []
  /** Index of the line break that ends the text `done` covers; -1 before any. */
  let covered = -1
  let requested = -1
  const compose = () => {
    const pending = text.slice(covered + 1).split('\n')
    if (pending.at(-1) === '')
      pending.pop()
    onLines([...done, ...pending.map(line => [{ text: line }])])
  }
  // The text only grows within one attempt, so a later cut always covers more.
  return (next: string) => {
    text = next
    compose()
    const cut = text.lastIndexOf('\n')
    if (cut <= requested)
      return
    requested = cut
    highlight(path, text.slice(0, cut)).then((lines) => {
      if (cut <= covered)
        return
      done = lines
      covered = cut
      compose()
    })
  }
}

/**
 * Runs the Endless Tram on the home page: compiles the seed, watches the player for a finished
 * choice at the newest stop, has the model write the next one, and hands the grown story back
 * to the player. One instance per script demo; `dispose()` cancels anything in flight.
 */
export function createAiRun(options: { player: StoryPlayer, locale: StoryLocale }): AiRun {
  const { player, locale } = options
  const status = ref<AiStatus>('starting')
  const story = shallowRef<Story>()
  const tokens = shallowRef<Record<string, SourceLines>>({})
  const writing = shallowRef<AiWriting>()
  const error = shallowRef<AiError>()
  const segments = shallowRef<readonly SegmentRecord[]>([])
  const usage = shallowRef<StoryUsage>()
  const highlighted = new Map<string, string>()
  let session: StorySession | undefined
  let controller: AbortController | undefined
  let pending: PlayerChoiceAction | undefined
  let generation = 0

  /** Stops are the `s<n>` chapters, named by their title anchor; the same for a live run and the sample. */
  const stops = computed(() => {
    const program = story.value?.program
    if (!program)
      return []
    return Object.keys(program.chapters)
      .filter(id => STOP.test(id))
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .map(id => ({ id, name: program.chapters[id].nodes[id]?.data?.text as string | undefined }))
  })

  const stations = computed<AiStation[]>(() => [{ id: DEPARTURE }, ...stops.value])

  function stationOf(chapterId: string) {
    return STOP.test(chapterId) ? chapterId : DEPARTURE
  }

  /** Re-highlights only the files whose text changed since last time. */
  async function refreshTokens(files: Record<string, string>) {
    const next = { ...tokens.value }
    await Promise.all(Object.entries(files).map(async ([path, source]) => {
      if (highlighted.get(path) === source && next[path])
        return
      next[path] = await highlight(path, source)
      highlighted.set(path, source)
    }))
    tokens.value = next
  }

  async function show(result: AdvProjectCompileResult, program: RuntimeProgram, files: Record<string, string>) {
    const [built] = await Promise.all([toStory(result, program, files), refreshTokens(files)])
    story.value = built
  }

  function fail(cause: unknown) {
    if (cause instanceof AiApiError && cause.type === 'aborted')
      return
    console.warn('[home] AI mode', cause)
    error.value = cause instanceof AiApiError
      ? { type: cause.type, message: cause.message }
      : { type: 'internal', message: cause instanceof Error ? cause.message : String(cause) }
    writing.value = undefined
    status.value = 'error'
  }

  /** The chapter whose choices are still open: the newest stop, or the departure. */
  const openChapter = () => segments.value.at(-1)?.chapterId ?? 'tram'

  async function advance(action: PlayerChoiceAction) {
    if (!session)
      return
    const run = ++generation
    pending = action
    controller?.abort()
    controller = new AbortController()
    error.value = undefined
    status.value = 'writing'
    const path = `adv/chapters/${endlessTram.chapterId(segments.value.length + 1)}/01.adv.md`
    writing.value = { path, attempt: 1, lines: [] }
    let attempt = 1
    const view = () => streamingView(path, (lines) => {
      if (run === generation && writing.value)
        writing.value = { ...writing.value, lines }
    })
    let update = view()
    try {
      const segment = await session.generate(action, player.state.value.variables, {
        signal: controller.signal,
        onText: (text, at) => {
          if (at !== attempt) {
            // The repair starts the file over.
            attempt = at
            update = view()
          }
          if (run === generation && writing.value)
            writing.value = { ...writing.value, attempt, title: titleOf(text) }
          update(text)
        },
      })
      const accepted = await session.accept(segment, action)
      if (run !== generation)
        return
      segments.value = [...session.segments]
      usage.value = { ...session.usage }
      await show(accepted.result, accepted.program, { ...session.files })
      pending = undefined
      writing.value = undefined
      status.value = 'playing'
      await player.continueAt(accepted.entry, accepted.variables)
    }
    catch (cause) {
      if (run === generation)
        fail(cause)
    }
  }

  // A choice at the open chapter ends its runtime there: that is the cue to write the next stop.
  const stopWatching = watch(() => player.state.value, (state) => {
    const choice = player.lastChoice.value
    if (status.value !== 'playing' || state.status !== 'ended' || !choice)
      return
    if (state.cursor.chapterId !== openChapter() || choice.chapterId !== openChapter())
      return
    advance({ kind: 'choice', chapterId: choice.chapterId, choiceId: choice.id, label: choice.label })
  })

  function reset() {
    generation++
    controller?.abort()
    pending = undefined
    error.value = undefined
    writing.value = undefined
    segments.value = []
    usage.value = undefined
  }

  return {
    status,
    story,
    tokens,
    writing,
    error,
    segments,
    usage,
    stations,
    stationOf,
    hasSample: !!endlessTramSample(locale),

    async start() {
      reset()
      const settings = loadSettings()
      if (!settings) {
        fail(new AiApiError('Add a provider and key first.', 'auth'))
        return
      }
      status.value = 'starting'
      const seed = endlessTramSeed(locale)
      session = createStorySession({
        mode: endlessTram,
        locale,
        projectId: `${STORY_ID}-${Date.now().toString(36)}`,
        seedFiles: seed.files,
        fallback: seed.fallback,
        chat: endpointOf(settings),
        compile: compileProject,
      })
      try {
        const compiled = await session.start()
        await show(compiled.result, compiled.program, { ...session.files })
        status.value = 'playing'
      }
      catch (cause) {
        fail(cause)
      }
    },

    async startSample() {
      reset()
      session = undefined
      const files = endlessTramSample(locale)
      if (!files)
        return
      status.value = 'starting'
      try {
        const result = await compileProject({ id: `${STORY_ID}-sample-${locale}`, files })
        if (!result.project.program)
          throw new Error('The sample run does not compile')
        await show(result, result.project.program, files)
        status.value = 'sample'
      }
      catch (cause) {
        fail(cause)
      }
    },

    async retry() {
      if (pending)
        await advance(pending)
      else
        await this.start()
    },

    finish() {
      generation++
      controller?.abort()
      writing.value = undefined
      status.value = 'finished'
    },

    dispose() {
      reset()
      stopWatching()
      session = undefined
    },
  }
}
