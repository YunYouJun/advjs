import type { PreviewMode, PreviewRunMode } from '../../../../apps/desktop/src/preview-presentation'
import { useDesktopStore } from '../stores/useDesktopStore'

/** Shared by the native menu and the Game panel; the host owns the player. */
export function useDesktopPreview() {
  const desktop = useDesktopStore()
  const busy = useState('desktop:preview-busy', () => false)
  const mode = computed(() => desktop.status.preview?.mode ?? 'embedded')
  const active = computed(() => !!desktop.status.preview?.active)
  const vueDevtools = computed(() => desktop.status.preview?.vueDevtools ?? false)
  const selectedRunMode = useState<PreviewRunMode>('desktop:preview-run-mode', () => 'live')
  const runMode = computed(() => active.value ? desktop.status.preview?.runMode ?? selectedRunMode.value : selectedRunMode.value)

  async function present(value: PreviewMode) {
    await window.advDesktop!.setPreviewPresentation(value)
    desktop.status = await window.advDesktop!.status()
  }
  async function start(value = mode.value, run: PreviewRunMode = runMode.value) {
    if (busy.value)
      return
    busy.value = true
    try {
      await present(value)
      selectedRunMode.value = run
      await window.advDesktop!.preview(run)
      desktop.status = await window.advDesktop!.status()
    }
    finally { busy.value = false }
  }
  async function stop() {
    await window.advDesktop!.cancelTask()
    await window.advDesktop!.stopPreview()
    desktop.status = await window.advDesktop!.status()
  }
  async function selectRunMode(value: PreviewRunMode) {
    if (active.value)
      await start(mode.value, value)
    else
      selectedRunMode.value = value
  }
  async function setVueDevtools(value: boolean) {
    if (busy.value || runMode.value !== 'live')
      return
    busy.value = true
    try {
      await window.advDesktop!.setPreferences({ previewVueDevtools: value })
      if (active.value)
        await window.advDesktop!.preview('live')
      desktop.status = await window.advDesktop!.status()
    }
    finally { busy.value = false }
  }
  return { mode, runMode, active, busy, vueDevtools, start, present, stop, selectRunMode, setVueDevtools }
}
