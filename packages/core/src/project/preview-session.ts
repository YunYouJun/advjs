export interface PreviewTraceEntry {
  sequence: number
  label: string
  messages: string[]
  changes: { key: string, before: unknown, after: unknown }[]
}

/** The adapter owns deterministic, in-memory state, including transient clocks and host effects. */
export interface PreviewSessionAdapter<Command> {
  reset: () => void | Promise<void>
  apply: (command: Command) => void | Promise<void>
  inspect: () => Record<string, unknown>
  describe: (command: Command) => { label: string, messages?: string[] }
}

/** Replay rolls back the whole host, rather than only a dialogue cursor. No persistence hooks. */
export function createPreviewSession<Command>(adapter: PreviewSessionAdapter<Command>, options: { maxInputs?: number, maxTraceEntries?: number } = {}) {
  const { maxInputs = 2000, maxTraceEntries = 200 } = options
  if (![maxInputs, maxTraceEntries].every(value => Number.isInteger(value) && value > 0))
    throw new Error('ADV_PREVIEW_INVALID_LIMIT: Limits must be positive integers')
  let commands: Command[] = []
  let trace: PreviewTraceEntry[] = []
  let busy = false
  let broken = false

  function record(command: Command, before: Record<string, unknown>, sequence: number) {
    const after = adapter.inspect()
    const description = adapter.describe(structuredClone(command))
    const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map(key => ({ key, before: before[key], after: after[key] }))
    trace = [...trace, structuredClone({ sequence, label: description.label, messages: description.messages ?? [], changes })].slice(-maxTraceEntries)
  }
  async function replay(inputs: readonly Command[]) {
    await adapter.reset()
    trace = []
    for (let index = 0; index < inputs.length; index++) {
      const before = structuredClone(adapter.inspect())
      await adapter.apply(structuredClone(inputs[index]!))
      record(inputs[index]!, before, index + 1)
    }
  }
  function assertReady() {
    if (busy)
      throw new Error('ADV_PREVIEW_BUSY: Preview is processing an input')
    if (broken)
      throw new Error('ADV_PREVIEW_REPLAY_FAILED: Restart the preview after an adapter replay failure')
  }
  return {
    inspect: () => ({ steps: commands.length, busy, broken, trace: structuredClone(trace) }),
    async dispatch(input: Command) {
      assertReady()
      if (commands.length >= maxInputs)
        throw new Error(`ADV_PREVIEW_INPUT_LIMIT: Preview reached ${maxInputs} inputs; restart it`)
      const command = structuredClone(input)
      busy = true
      try {
        const before = structuredClone(adapter.inspect())
        await adapter.apply(structuredClone(command))
        record(command, before, commands.length + 1)
        commands.push(command)
      }
      catch (error) {
        try {
          await replay(commands)
        }
        catch (cause) {
          broken = true
          throw new Error('ADV_PREVIEW_REPLAY_FAILED: Adapter could not restore prior inputs', { cause })
        }
        throw error
      }
      finally { busy = false }
    },
    async back() {
      assertReady()
      if (!commands.length)
        return
      busy = true
      const previous = commands.slice(0, -1)
      try {
        await replay(previous)
        commands = previous
      }
      catch (error) {
        try {
          await replay(commands)
        }
        catch (cause) {
          broken = true
          throw new Error('ADV_PREVIEW_REPLAY_FAILED: Adapter could not restore prior inputs', { cause })
        }
        throw error
      }
      finally { busy = false }
    },
  }
}
