import type { AdvCharacter, CharacterVoiceProfile } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { parseCharacterMd } from '@advjs/parser'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import VoiceProfileFields from '../components/audio/VoiceProfileFields.vue'
import SSelect from '../components/ui/SSelect.vue'
import { useContentSave } from '../composables/useContentSave'
import zh from '../i18n/locales/zh-CN.json'

function mountFields(profile?: CharacterVoiceProfile) {
  return mount(VoiceProfileFields, { props: { modelValue: profile }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })] } })
}

describe('studio native VoiceProfile form', () => {
  it('requires explicit model, actual voice and source; cloned bindings require project consent metadata', async () => {
    const profile: CharacterVoiceProfile = { intent: { speakingStyle: 'Calm' }, locales: { en: { providers: { existing: { model: 'old-model', voiceId: 'old-voice', source: 'system' } } } } }
    const original = JSON.stringify(profile)
    const wrapper = mountFields(profile)
    for (const [field, value] of Object.entries({ locale: 'zh-cn', providerId: 'configured-provider', model: 'actual-model', voiceId: 'actual-voice' }))
      await wrapper.find(`[data-field="${field}"] input`).setValue(value)
    const apply = () => wrapper.findAll('button').find(button => button.text() === '应用服务绑定')!.trigger('click')
    await apply()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.findAllComponents(SSelect).at(-1)!.vm.$emit('update:modelValue', 'cloned')
    await wrapper.vm.$nextTick()
    await apply()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const rights = wrapper.findAll('input').slice(-3)
    await rights[0]!.setValue('Project consent license')
    await rights[1]!.setValue('Consenting speaker')
    await rights[2]!.setValue('adv/consent/speaker.json')
    await apply()
    const emitted = wrapper.emitted('update:modelValue')![0]![0] as CharacterVoiceProfile
    expect(emitted.locales?.['zh-CN']?.providers['configured-provider']).toEqual({ model: 'actual-model', voiceId: 'actual-voice', source: 'cloned', rights: { license: 'Project consent license', subject: 'Consenting speaker', consentRecord: 'adv/consent/speaker.json' } })
    expect(emitted.locales?.en).toEqual(profile.locales?.en)
    expect(emitted.intent).toEqual(profile.intent)
    expect(JSON.stringify(profile)).toBe(original)
    wrapper.unmount()
  })

  it('saves the form profile through the real character YAML seam and rejects invalid profiles without writes', async () => {
    const writes = new Map<string, string>()
    const fs = { exists: async (path: string) => writes.has(path), mkdir: async () => {}, writeFile: async (path: string, content: string) => writes.set(path, content) } as unknown as IFileSystem
    const profile: CharacterVoiceProfile = { intent: { pace: 'slow', temperament: ['calm', 'thoughtful'] }, locales: { en: { providers: { reviewed: { voiceId: 'actual-voice', model: 'actual-model', source: 'system' } } } } }
    const character: AdvCharacter = { id: 'hero', name: 'Hero', voiceProfile: profile }
    const service = useContentSave()
    expect(await service.saveContent(fs, 'character', 'create', character)).toMatchObject({ success: true, filePath: 'adv/characters/hero.character.md' })
    const saved = writes.get('adv/characters/hero.character.md')!
    expect(parseCharacterMd(saved).voiceProfile).toEqual(profile)
    const invalid = { ...character, voiceProfile: { ...profile, apiKey: 'private' } }
    expect(await service.saveContent(fs, 'character', 'edit', invalid, 'hero')).toMatchObject({ success: false })
    expect(writes.get('adv/characters/hero.character.md')).toBe(saved)
  })
})
