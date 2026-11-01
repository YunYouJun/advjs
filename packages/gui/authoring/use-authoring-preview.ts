import type { Ref } from 'vue'
import type { AuthoringPreviewAdapter, AuthoringPreviewHost } from './preview-types'
import { computed, getCurrentScope, onScopeDispose, shallowRef } from 'vue'

/** Freeze a run through the host adapter; gate all inputs when its source becomes stale. */
export function useAuthoringPreview<Source, Command, View>(
  source: Readonly<Ref<Source>>,
  invalid: Readonly<Ref<boolean>>,
  adapter: AuthoringPreviewAdapter<Source, Command, View>,
) {
  let host: AuthoringPreviewHost<Command, View> | null = null
  let disposed = false
  if (getCurrentScope())
    onScopeDispose(() => { disposed = true })
  const view = shallowRef<View | null>(null)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const captured = shallowRef<string | null>(null)
  const stale = computed(() => captured.value !== null && captured.value !== adapter.revision(source.value))
  const disabled = computed(() => busy.value || invalid.value || stale.value)
  const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

  async function start(): Promise<void> {
    if (disposed || busy.value || invalid.value)
      return
    busy.value = true
    error.value = ''
    try {
      // Capture before awaiting: edits made while creating the host must mark this run stale.
      const revision = adapter.revision(source.value)
      const next = await adapter.create(source.value)
      const snapshot = next.inspect()
      if (!disposed) {
        host = next
        view.value = snapshot
        captured.value = revision
      }
    }
    catch (cause) {
      if (!disposed)
        error.value = message(cause)
    }
    finally {
      if (!disposed)
        busy.value = false
    }
  }
  async function execute(command?: { value: Command }): Promise<void> {
    if (disposed || disabled.value || !host)
      return
    busy.value = true
    error.value = ''
    try {
      if (command)
        await host.dispatch(command.value)
      else await host.back()
    }
    catch (cause) {
      if (!disposed)
        error.value = message(cause)
    }
    finally {
      if (!disposed) {
        try {
          view.value = host.inspect()
        }
        catch (cause) { error.value = message(cause) }
        busy.value = false
      }
    }
  }
  return { view, busy, error, stale, disabled, start, dispatch: (command: Command) => execute({ value: command }), back: () => execute() }
}
