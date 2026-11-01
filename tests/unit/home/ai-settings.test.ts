import { beforeEach, describe, expect, it } from 'vitest'
import { checkSettings, clearSettings, defaultSettings, hostOf, loadSettings, saveSettings, SETTINGS_KEY } from '../../../docs/.vitepress/theme/components/home/ai/settings'

const settings = { providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: ' sk-test ' }

describe('home AI settings', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('keeps settings in this tab unless asked to remember them', () => {
    saveSettings(settings, false)
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull()
    expect(loadSettings()).toEqual({ ...settings, apiKey: 'sk-test', remember: false })
  })

  it('remembers on this device only when asked, and moves between the two', () => {
    saveSettings(settings, true)
    expect(sessionStorage.getItem(SETTINGS_KEY)).toBeNull()
    expect(loadSettings()?.remember).toBe(true)

    saveSettings(settings, false)
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull()
    expect(loadSettings()?.remember).toBe(false)
  })

  it('clears both places', () => {
    saveSettings(settings, true)
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    clearSettings()
    expect(loadSettings()).toBeUndefined()
  })

  it('ignores malformed storage', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json')
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: 1 }))
    expect(loadSettings()).toBeUndefined()
  })

  it('checks the address, model and key before anything is sent', () => {
    expect(checkSettings({ ...settings, baseURL: 'http://api.example.com/v1' })).toBe('baseURL')
    expect(checkSettings({ ...settings, model: ' ' })).toBe('model')
    expect(checkSettings({ ...settings, apiKey: '' })).toBe('apiKey')
    expect(checkSettings({ providerId: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'qwen2.5', apiKey: '' })).toBeUndefined()
    expect(checkSettings(settings)).toBeUndefined()
  })

  it('names the host the key goes to', () => {
    expect(hostOf(defaultSettings().baseURL)).toBe('api.deepseek.com')
    expect(hostOf('nonsense')).toBe('')
  })
})
