import type { VoiceProviderDiagnosis, VoiceProviderStatusSnapshot } from '@advjs/types'
import type { OfficialPluginDescriptor } from '../../extensions/official-plugins'
import { officialPluginText } from '../../extensions/official-plugins'

export interface OfficialPluginView {
  entry: OfficialPluginDescriptor
  provider?: VoiceProviderStatusSnapshot['providers'][number]
  diagnosis?: VoiceProviderDiagnosis
  failed: boolean
  status: {
    state: string
    label: string
    tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  }
}

export function officialPluginStatus(input: {
  connected: boolean
  loading: boolean
  readFailed: boolean
  checking: string
  entry: OfficialPluginDescriptor
  provider?: VoiceProviderStatusSnapshot['providers'][number]
  diagnosis?: VoiceProviderDiagnosis
  failed: boolean
}, locale: string): OfficialPluginView['status'] {
  const state = !input.connected ? 'no-host' : input.loading ? 'loading' : input.readFailed ? 'configuration-error' : !input.provider ? 'unconfigured' : !input.provider.enabled ? 'disabled' : !input.provider.diagnostics ? 'diagnostics-unavailable' : input.checking === input.entry.id ? 'checking' : input.failed ? 'failed' : input.diagnosis?.state ?? 'unchecked'
  const labels: Record<string, { 'zh-CN': string, 'en': string }> = {
    'no-host': { 'zh-CN': '未连接状态接口', 'en': 'No status interface' },
    'loading': { 'zh-CN': '读取配置中', 'en': 'Reading configuration' },
    'configuration-error': { 'zh-CN': '配置读取失败', 'en': 'Configuration unavailable' },
    'unconfigured': { 'zh-CN': '项目未配置', 'en': 'Not configured in project' },
    'disabled': { 'zh-CN': '项目已停用', 'en': 'Disabled in project' },
    'diagnostics-unavailable': { 'zh-CN': '未提供检测接口', 'en': 'Diagnostics unavailable' },
    'checking': { 'zh-CN': '正在检查', 'en': 'Checking' },
    'failed': { 'zh-CN': '检查未完成', 'en': 'Check incomplete' },
    'unchecked': { 'zh-CN': '已配置 · 尚未检查', 'en': 'Configured · not checked' },
    'ready': { 'zh-CN': '检查通过', 'en': 'Check passed' },
    'not-ready': { 'zh-CN': '尚未就绪', 'en': 'Not ready' },
    'unsupported': { 'zh-CN': '当前平台不支持', 'en': 'Platform unsupported' },
  }
  const tone = state === 'ready' ? 'success' : ['configuration-error', 'failed'].includes(state) ? 'danger' : ['not-ready', 'unsupported'].includes(state) ? 'warning' : ['loading', 'checking', 'unchecked'].includes(state) ? 'info' : 'neutral'
  return { state, label: officialPluginText(labels[state]!, locale), tone }
}

const checkDescriptions: Record<string, { 'zh-CN': string, 'en': string }> = {
  'platform': { 'zh-CN': '平台兼容性', 'en': 'Platform compatibility' },
  'environment': { 'zh-CN': 'Python 环境准备状态', 'en': 'Prepared Python environment' },
  'uv': { 'zh-CN': 'Python 环境管理器', 'en': 'Python environment manager' },
  'runtime': { 'zh-CN': '运行时依赖版本', 'en': 'Runtime dependency versions' },
  'model-cache': { 'zh-CN': '本地模型缓存状态；未核验所选权重', 'en': 'Local model cache status; selected weights unverified' },
  'loaded-model': { 'zh-CN': '本机 Breeze 模型加载状态；未核验权重修订', 'en': 'Local Breeze model loading status; weight revision unverified' },
  'credentials': { 'zh-CN': '宿主凭证配置；未验证远端服务或额度', 'en': 'Host credentials; remote service and quota unverified' },
  'connectivity': { 'zh-CN': '远端服务、账号权限与额度尚未验证', 'en': 'Remote service, permissions, and quota unverified' },
  'diagnostics': { 'zh-CN': '供应商诊断接口', 'en': 'Provider diagnostic support' },
}

export function officialPluginCheckDescription(id: string, locale: string) {
  return checkDescriptions[id] ? officialPluginText(checkDescriptions[id], locale) : locale === 'zh-CN' ? '其他供应商检查' : 'Additional provider check'
}
