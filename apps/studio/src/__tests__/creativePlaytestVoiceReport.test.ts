import type { CreativePlaytestVoiceCoverage } from '@advjs/agent'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import CreativePlaytestVoiceReport from '../components/creative-team/CreativePlaytestVoiceReport.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

const coverage: CreativePlaytestVoiceCoverage = { verification: 'author-host-byte-check', snapshotRevision: `sha256:${'a'.repeat(64)}`, locale: 'zh-CN', complete: false, rowsOmitted: 3, rows: [{ address: 'intro#start.dialog', lineId: 'line-fixture', speakerId: '<script>speaker</script>', status: 'missing', takes: 0, profileMissing: true, source: { path: 'adv/chapters/intro.adv.md', line: 4 } }] }
function options() {
  return { global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })] } }
}

describe('readonly voice observations in playtest reports', () => {
  it('labels missing, incomplete and omitted evidence and emits the actual source only on explicit navigation', async () => {
    const wrapper = mount(CreativePlaytestVoiceReport, { ...options(), props: { coverage, navigable: true } })
    expect(wrapper.text()).toContain('缺少配音')
    expect(wrapper.text()).toContain('不证明实际播放或表演质量')
    expect(wrapper.text()).toContain('配音清单不完整')
    expect(wrapper.text()).toContain('另有 3 行')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.emitted('source')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('source')).toEqual([['adv/chapters/intro.adv.md', 4]])
    wrapper.unmount()
  })

  it('keeps embedded director evidence readonly with no inactive source button', () => {
    const wrapper = mount(CreativePlaytestVoiceReport, { ...options(), props: { coverage } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('adv/chapters/intro.adv.md:4')
    wrapper.unmount()
  })
})
