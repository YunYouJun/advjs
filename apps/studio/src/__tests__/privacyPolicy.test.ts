import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const studioSourceRoot = resolve(import.meta.dirname, '..')

function readStudioFile(path: string): string {
  return readFileSync(resolve(studioSourceRoot, path), 'utf8')
}

describe('studio privacy policy', () => {
  it('publishes a same-origin public privacy route', () => {
    const router = readStudioFile('router/index.ts')
    const settings = readStudioFile('views/settings/SettingsPrivacyPage.vue')

    expect(router).toContain('path: \'/privacy\'')
    expect(router).toContain('import(\'@/views/PrivacyPolicyPage.vue\')')
    expect(settings).toContain('href="/privacy"')
    expect(settings).not.toContain('href="https://advjs.org/privacy"')
  })

  it('discloses the product data flows and user controls', () => {
    const policy = readStudioFile('views/PrivacyPolicyPage.vue')

    for (const disclosure of [
      '云乐坊账号',
      '云同步与发布',
      '托管 AI',
      '匿名使用统计（默认关闭）',
      '你的权利与选择',
      '个人信息处理者',
    ]) {
      expect(policy).toContain(disclosure)
    }
  })

  it('renders inside the Ionic scroll container', () => {
    const policy = readStudioFile('views/PrivacyPolicyPage.vue')

    expect(policy).toContain('import { IonContent, IonPage } from \'@ionic/vue\'')
    expect(policy).toContain('<IonPage>')
    expect(policy).toContain('<IonContent :fullscreen="true">')
  })
})
