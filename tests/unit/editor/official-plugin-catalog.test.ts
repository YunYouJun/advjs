import type { VoiceProviderDiagnosis, VoiceProviderStatusPort, VoiceProviderStatusSnapshot } from '@advjs/types'
import type { App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import OfficialPluginCatalog from '../../../editor/core/app/components/extensions/OfficialPluginCatalog.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
})

function fixture(snapshot: VoiceProviderStatusSnapshot = { configured: true, providers: [{ id: 'breeze-tts', enabled: true, diagnostics: true }] }) {
  const port = shallowRef<VoiceProviderStatusPort | undefined>({ read: vi.fn().mockResolvedValue(snapshot), doctor: vi.fn().mockResolvedValue({ providerId: 'breeze-tts', state: 'ready', checkedAt: new Date().toISOString(), checks: [{ id: 'loaded-model', status: 'pass', message: 'not rendered as raw prose' }] }) })
  const locale = shallowRef('zh-CN')
  const visible = shallowRef(true)
  const element = document.createElement('div')
  document.body.append(element)
  function mount() {
    app = createApp(defineComponent({ setup: () => () => h(OfficialPluginCatalog, { locale: locale.value, port: port.value, visible: visible.value }) }))
    app.mount(element)
  }
  const button = (id = 'breeze-tts') => element.querySelector<HTMLButtonElement>(`[data-testid="official-plugin-check-${id}"]`)!
  const state = (id = 'breeze-tts') => element.querySelector(`[data-testid="official-plugin-state-${id}"]`)!.textContent
  return { port, locale, visible, element, mount, button, state }
}

describe('official audio plugin catalog', () => {
  it('shows source setup, platform boundaries and project configuration without automatically probing', async () => {
    const f = fixture()
    f.mount()
    await vi.waitFor(() => expect(f.state()).toBe('已配置 · 尚未检查'))
    expect(f.port.value!.doctor).not.toHaveBeenCalled()
    expect(f.state('openai-tts')).toBe('项目未配置')
    expect(f.element.textContent).toContain('pnpm add -D "link:/absolute/path/to/advjs/plugins/plugin-breeze-tts"')
    expect(f.element.textContent).toContain('Node 宿主')
    expect(f.element.textContent).toContain('16 GB')
    expect(f.element.textContent).toContain('未验证远端服务')
    f.button().click()
    await vi.waitFor(() => expect(f.state()).toBe('检查通过'))
    expect(f.port.value!.doctor).toHaveBeenCalledOnce()
    expect(f.element.textContent).toContain('本机 Breeze 模型加载状态')
    expect(f.element.textContent).not.toContain('not rendered as raw prose')
    f.locale.value = 'en'
    await nextTick()
    expect(f.state()).toBe('Check passed')
    expect(f.button().getAttribute('aria-label')).toBe('Check status Breeze TTS 2')
    expect(f.element.textContent).toContain('remote service')
  })

  it('distinguishes a missing host, disabled providers, and unavailable diagnostics', async () => {
    const f = fixture({ configured: true, providers: [{ id: 'breeze-tts', enabled: true, diagnostics: false }, { id: 'qwen-tts', enabled: false, diagnostics: true }] })
    f.mount()
    await vi.waitFor(() => expect(f.state()).toBe('未提供检测接口'))
    expect(f.button().disabled).toBe(true)
    expect(f.state('qwen-tts')).toBe('项目已停用')
    expect(f.button('qwen-tts').disabled).toBe(true)
    f.port.value = undefined
    await nextTick()
    expect(f.state()).toBe('未连接状态接口')
    expect(f.element.querySelector('[data-testid="official-catalog-no-host"]')).not.toBeNull()
  })

  it('aborts hidden checks, ignores late results and clears outcomes on project switch', async () => {
    const f = fixture()
    let finish!: (value: VoiceProviderDiagnosis) => void
    const doctor = vi.fn().mockImplementation(() => new Promise<VoiceProviderDiagnosis>((resolve) => {
      finish = resolve
    }))
    f.port.value!.doctor = doctor
    f.mount()
    await vi.waitFor(() => expect(f.state()).toBe('已配置 · 尚未检查'))
    f.button().click()
    await vi.waitFor(() => expect(doctor).toHaveBeenCalledOnce())
    f.visible.value = false
    await nextTick()
    expect(doctor.mock.calls[0]![1].aborted).toBe(true)
    finish({ providerId: 'breeze-tts', state: 'ready', checkedAt: '', checks: [] })
    await nextTick()
    expect(f.state()).not.toBe('检查通过')
    const next = { read: vi.fn().mockResolvedValue({ configured: false, providers: [] }), doctor: vi.fn() }
    f.port.value = next
    f.visible.value = true
    await vi.waitFor(() => expect(f.state()).toBe('项目未配置'))
    expect(next.doctor).not.toHaveBeenCalled()
  })

  it('shows bounded failures without exception contents and cancels reads on unmount', async () => {
    const f = fixture()
    f.port.value!.doctor = vi.fn().mockRejectedValue(new Error('secret-key private command'))
    f.mount()
    await vi.waitFor(() => expect(f.state()).toBe('已配置 · 尚未检查'))
    f.button().click()
    await vi.waitFor(() => expect(f.state()).toBe('检查未完成'))
    expect(f.element.textContent).not.toMatch(/secret-key|private command/u)
    const read = vi.fn().mockRejectedValue(new Error('secret configuration'))
    f.port.value = { read, doctor: vi.fn() }
    await vi.waitFor(() => expect(f.state()).toBe('配置读取失败'))
    expect(f.element.textContent).not.toContain('secret configuration')
    const pending = vi.fn().mockImplementation(() => new Promise(() => {}))
    f.port.value = { read: pending, doctor: vi.fn() }
    await vi.waitFor(() => expect(pending).toHaveBeenCalledOnce())
    app!.unmount()
    app = undefined
    expect(pending.mock.calls[0]![0].aborted).toBe(true)
  })
})
