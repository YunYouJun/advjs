import type { JsonObject, JsonValue, RuntimeActionCall, RuntimeAddress, RuntimeChoice, RuntimeExpression, RuntimeNode, RuntimeSnapshot, RuntimeState } from '@advjs/types'
import type { InjectionKey, Ref } from 'vue'
import type { Story } from '../components/home/data/skins'
import { computed, inject, ref, shallowRef, watch } from 'vue'
import { createAdvRuntime, runtimeConditionMatches } from '../../../../packages/core/src/runtime/headless'
import { useTimer } from './home'

const SCENE_HOLD = 1700
const LINE_HOLD = 2400

export interface PlayerLine {
  speaker?: string
  text: string
  /** Changes for every line, so a typewriter can remount on it. */
  key: number
}

export interface PlayerChoice {
  id: string
  label: string
  to: RuntimeAddress
  /** Where it jumps, as the script writes it: `#anchor`, or `chapter#anchor` across chapters. */
  target: string
  /** It has no target yet: it runs on to the end of the chapter (an AI stop not written yet). */
  open: boolean
  /** Hidden by the runtime because its `when` is false. */
  locked: boolean
  when?: string
  /** What its `actions` do, e.g. `affection +1`. */
  effects: string[]
}

export interface VariableChange {
  key: string
  from?: JsonValue
  to?: JsonValue
}

/** Writes a compiled condition back the way the script spells it. */
export function formatWhen(expression: RuntimeExpression): string {
  switch (expression.type) {
    case 'literal':
      return JSON.stringify(expression.value)
    case 'variable':
      return expression.path.join('.')
    case 'unary':
      return `${expression.operator}${formatWhen(expression.argument)}`
    case 'binary':
      return `${formatWhen(expression.left)} ${expression.operator} ${formatWhen(expression.right)}`
  }
}

/** Sums up a built-in action the way a reader would say it. */
export function formatAction(action: RuntimeActionCall): string {
  const { key, value, by } = (action.args ?? {}) as { key?: string, value?: JsonValue, by?: number }
  switch (action.type) {
    case 'variables/increment':
      return `${key} +${by ?? 1}`
    case 'variables/decrement':
      return `${key} -${by ?? 1}`
    case 'variables/set':
      return `${key} = ${JSON.stringify(value)}`
    case 'variables/toggle':
      return `!${key}`
    case 'variables/push':
    case 'variables/push-unique':
      return `${key} + ${JSON.stringify(value)}`
    case 'variables/remove':
      return `${key} - ${JSON.stringify(value)}`
    default:
      return action.type
  }
}

/** `chapter#node`, the key the story's source map uses. */
export const addressKey = (address: RuntimeAddress) => `${address.chapterId}#${address.nodeId}`

/**
 * Plays a home page story on the real headless runtime (`createAdvRuntime`), one beat at a time.
 * The runtime steps over scenes, anchors and actions without pausing; the player replays the
 * scene heading it passed as its own beat, and remembers which nodes it went through so the
 * project explorer can light up the file and lines that ran, across files and chapters.
 */
export function useStoryPlayer(story: Ref<Story>, active: Ref<boolean>) {
  const timer = useTimer()

  const program = computed(() => story.value.program)
  const nodeAt = (address: RuntimeAddress | undefined): RuntimeNode | undefined =>
    address && program.value.chapters[address.chapterId]?.nodes[address.nodeId]
  /** Finds a node by id in any chapter: anchors are unique across a story. */
  const findNode = (id: string) => Object.values(program.value.chapters)
    .map(chapter => chapter.nodes[id])
    .find(Boolean)

  const create = () => createAdvRuntime({ program: story.value.program, initialVariables: story.value.variables })
  let runtime = create()
  const state = shallowRef<RuntimeState>(runtime.state)
  const started = ref(false)
  /** The scene heading on screen before the runtime's own stop. */
  const scene = ref<RuntimeAddress>()
  /** Nodes (`chapter#node`) the last step went through without stopping. */
  const passed = ref<string[]>([])
  /** Anchors passed since the story last returned to its entry. */
  const trail = ref<string[]>([])
  const changes = ref<VariableChange[]>([])
  /** The last choice taken, and the chapter it was offered in. */
  const lastChoice = ref<{ chapterId: string, id: string, label: string }>()
  /** Lines shown so far, oldest first: the backlog. */
  const history = ref<PlayerLine[]>([])
  const said = ref<PlayerLine>()
  const typed = ref(false)
  const instant = ref(false)
  const auto = ref(true)
  /** Counts beats, so a scene heading and the stop behind it count as two. */
  const beat = ref(0)
  let seq = 0
  let busy = false

  /** The node on screen: a scene heading, or where the runtime stopped. */
  const address = computed<RuntimeAddress>(() => scene.value ?? state.value.cursor)
  const currentId = computed(() => address.value.nodeId)
  const chapterId = computed(() => address.value.chapterId)
  const currentKey = computed(() => addressKey(address.value))
  const current = computed(() => nodeAt(address.value)!)
  const variables = computed(() => state.value.variables)
  /** What the story's stage blocks (`type: background` and the like) have set. */
  const stage = computed(() => state.value.stage)

  const choices = computed<PlayerChoice[]>(() => {
    if (scene.value || current.value?.kind !== 'choices')
      return []
    const options = (current.value.data?.options ?? []) as unknown as RuntimeChoice[]
    return options.map((option) => {
      const to = typeof option.target === 'string'
        ? { chapterId: chapterId.value, nodeId: option.target }
        : option.target ?? state.value.cursor
      return {
        id: option.id,
        label: option.label,
        to,
        target: to.chapterId === chapterId.value ? `#${to.nodeId}` : `${to.chapterId}#${to.nodeId}`,
        open: !option.target,
        locked: !runtimeConditionMatches(option.when, state.value.variables),
        when: option.when && formatWhen(option.when),
        effects: (option.actions ?? []).map(formatAction),
      }
    })
  })

  /** The condition the node on screen passed, if any. */
  const when = computed(() => current.value?.when && formatWhen(current.value.when))

  /** The playhead: the file the node on screen came from. */
  const file = computed(() => story.value.nodes[currentKey.value]?.file)
  /** Lit lines, per file: the node on screen and what the last step ran on the way. */
  const lines = computed(() => {
    const lit: Record<string, Set<number>> = {}
    for (const key of [currentKey.value, ...passed.value]) {
      const source = story.value.nodes[key]
      if (source)
        source.lines.forEach(line => (lit[source.file] ??= new Set()).add(line))
    }
    return lit
  })

  function show(record = true) {
    beat.value++
    const node = current.value
    if (node?.kind === 'dialog' || node?.kind === 'narration') {
      typed.value = false
      instant.value = false
      said.value = {
        speaker: node.kind === 'dialog' ? node.data!.character as string : undefined,
        text: node.data!.text as string,
        key: ++seq,
      }
      if (record)
        history.value = [...history.value, said.value].slice(-50)
    }
    else if (node?.kind === 'scene') {
      said.value = undefined
    }
    // At a choice the last line stays on screen.
  }

  /** Takes the runtime's new state; `from` is the first node this step entered. */
  function land(from: RuntimeAddress | undefined, record = true) {
    const previous = state.value
    const next = runtime.state
    state.value = next

    const stop = addressKey(next.cursor)
    const path: { address: RuntimeAddress, node: RuntimeNode }[] = []
    for (let at = from; at && addressKey(at) !== stop && path.length < 64; at = nodeAt(at)?.next) {
      const node = nodeAt(at)
      if (!node)
        break
      path.push({ address: at, node })
    }
    // Skipped by a false condition: nothing ran, so nothing lights up.
    passed.value = path
      .filter(({ node }) => node.kind !== 'scene' && runtimeConditionMatches(node.when, next.variables))
      .map(({ address }) => addressKey(address))
    scene.value = [...path].reverse().find(({ node }) => node.kind === 'scene')?.address

    const entry = addressKey(program.value.entry)
    const anchors = path
      .filter(({ node, address }) => node.kind === 'anchor' || addressKey(address) === entry)
      .map(({ node }) => node.id)
    trail.value = path.some(({ address }) => addressKey(address) === entry) ? anchors : [...trail.value, ...anchors]

    const keys = new Set([...Object.keys(previous.variables), ...Object.keys(next.variables)])
    changes.value = [...keys]
      .filter(key => JSON.stringify(previous.variables[key]) !== JSON.stringify(next.variables[key]))
      .map(key => ({ key, from: previous.variables[key], to: next.variables[key] }))

    show(record)
  }

  async function run(from: RuntimeAddress | undefined, step: () => Promise<unknown>) {
    if (busy)
      return
    busy = true
    try {
      await step()
      land(from)
    }
    catch (error) {
      console.warn('[home] runtime step failed', error)
    }
    finally {
      busy = false
    }
  }

  async function start() {
    started.value = true
    await run(program.value.entry, () => runtime.start())
  }

  async function next() {
    if (scene.value) {
      scene.value = undefined
      return show()
    }
    const node = current.value
    // After an ending, the next beat starts the story over from its entry.
    if (node?.kind === 'end' || state.value.status === 'ended')
      return jump(program.value.entry)
    if (!node || node.kind === 'choices')
      return
    if (!typed.value) {
      instant.value = true
      return
    }
    await run(node.next, () => runtime.next())
  }

  async function choose(choice: PlayerChoice) {
    if (choice.locked)
      return
    lastChoice.value = { chapterId: chapterId.value, id: choice.id, label: choice.label }
    await run(choice.to, () => runtime.choose(choice.id))
  }

  /** Jumps to any node, the way `go()` does: variables stay, the cursor moves. */
  async function jump(to: RuntimeAddress) {
    if (!started.value)
      await start()
    await run(to, () => runtime.go(to))
  }

  /** A full runtime snapshot: cursor, variables, stage and history checkpoints, as JSON. */
  function save(): RuntimeSnapshot {
    return runtime.snapshot()
  }

  /** Restores a snapshot; the runtime checks it belongs to this story before it accepts it. */
  function load(snapshot: RuntimeSnapshot) {
    timer.clear()
    try {
      runtime.restore(snapshot)
      land(undefined, false)
    }
    catch (error) {
      console.warn('[home] snapshot rejected', error)
    }
  }

  /**
   * Carries on in a grown story (same program id, new chapters): a fresh runtime on the new
   * program starts at `to` with `variables`. The backlog, trail and playhead stay.
   */
  async function continueAt(to: RuntimeAddress, variables: JsonObject) {
    timer.clear()
    runtime = createAdvRuntime({ program: story.value.program, initialVariables: variables })
    started.value = true
    await run(to, () => runtime.go(to))
  }

  function reset() {
    timer.clear()
    runtime = create()
    state.value = runtime.state
    started.value = false
    scene.value = undefined
    passed.value = []
    trail.value = []
    changes.value = []
    history.value = []
    said.value = undefined
    typed.value = false
    lastChoice.value = undefined
  }

  watch(story, async (next, previous) => {
    // The same program growing (AI mode adds a chapter) carries on through `continueAt`.
    if (previous && next.program.id === previous.program.id)
      return
    reset()
    if (active.value)
      await start()
  })

  // Start once the stage is on screen, then keep playing while it is.
  watch(active, (on) => {
    if (on && !started.value)
      start()
  })

  watch([beat, typed, auto, active, started], () => {
    timer.clear()
    if (!started.value || !auto.value || !active.value)
      return
    if (scene.value)
      timer.start(next, SCENE_HOLD)
    else if (said.value && typed.value && current.value?.kind !== 'choices')
      timer.start(next, LINE_HOLD)
  })

  return {
    story,
    program,
    state,
    started,
    current,
    currentId,
    currentKey,
    chapterId,
    file,
    variables,
    stage,
    changes,
    history,
    choices,
    when,
    lines,
    trail,
    said,
    typed,
    instant,
    auto,
    findNode,
    next,
    choose,
    jump,
    continueAt,
    lastChoice,
    save,
    load,
  }
}

export type StoryPlayer = ReturnType<typeof useStoryPlayer>

export const playerKey: InjectionKey<StoryPlayer> = Symbol('story-player')

export function usePlayer(): StoryPlayer {
  return inject(playerKey)!
}
