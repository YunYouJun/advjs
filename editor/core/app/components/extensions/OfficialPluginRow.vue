<script setup lang="ts">
import type { VoiceProviderDiagnosis, VoiceProviderStatusSnapshot } from '@advjs/types'
import type { OfficialPluginDescriptor } from '../../extensions/official-plugins'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed } from 'vue'
import { officialPluginInstallCommands, officialPluginSource, officialPluginText } from '../../extensions/official-plugins'

const props = defineProps<{
  entry: OfficialPluginDescriptor
  locale: string
  provider?: VoiceProviderStatusSnapshot['providers'][number]
  diagnosis?: VoiceProviderDiagnosis
  connected: boolean
  loading: boolean
  readFailed: boolean
  checking: string
  failed?: boolean
}>()
const emit = defineEmits<{ check: [providerId: string] }>()
const zh = computed(() => props.locale === 'zh-CN')
const text = (value: Parameters<typeof officialPluginText>[0]) => officialPluginText(value, props.locale)
const state = computed(() => !props.connected ? 'no-host' : props.loading ? 'loading' : props.readFailed ? 'configuration-error' : !props.provider ? 'unconfigured' : !props.provider.enabled ? 'disabled' : !props.provider.diagnostics ? 'diagnostics-unavailable' : props.checking === props.entry.id ? 'checking' : props.failed ? 'failed' : props.diagnosis?.state ?? 'unchecked')
const labels = computed<Record<string, string>>(() => zh.value
  ? {
      'no-host': '未连接状态接口',
      'loading': '读取配置中',
      'configuration-error': '配置读取失败',
      'unconfigured': '项目未配置',
      'disabled': '项目已停用',
      'diagnostics-unavailable': '未提供检测接口',
      'checking': '正在检查',
      'failed': '检查未完成',
      'unchecked': '已配置 · 尚未检查',
      'ready': '检查通过',
      'not-ready': '尚未就绪',
      'unsupported': '当前平台不支持',
    }
  : {
      'no-host': 'No status interface',
      'loading': 'Reading configuration',
      'configuration-error': 'Configuration unavailable',
      'unconfigured': 'Not configured in project',
      'disabled': 'Disabled in project',
      'diagnostics-unavailable': 'Diagnostics unavailable',
      'checking': 'Checking',
      'failed': 'Check incomplete',
      'unchecked': 'Configured · not checked',
      'ready': 'Check passed',
      'not-ready': 'Not ready',
      'unsupported': 'Platform unsupported',
    })
const checkDescriptions: Record<string, { 'zh-CN': string, 'en': string }> = {
  'platform': { 'zh-CN': '平台兼容性', 'en': 'Platform compatibility' },
  'environment': { 'zh-CN': 'Python 环境准备状态', 'en': 'Prepared Python environment' },
  'uv': { 'zh-CN': 'Python 环境管理器', 'en': 'Python environment manager' },
  'runtime': { 'zh-CN': '运行时依赖版本', 'en': 'Runtime dependency versions' },
  'model-cache': { 'zh-CN': '本地模型缓存存在；未核验所选权重', 'en': 'Local model cache presence; selected weights unverified' },
  'loaded-model': { 'zh-CN': '本机 Breeze 模型加载状态；未核验权重修订', 'en': 'Local Breeze model loading status; weight revision unverified' },
  'credentials': { 'zh-CN': '宿主凭证配置；未验证远端服务或额度', 'en': 'Host credentials; remote service and quota unverified' },
  'connectivity': { 'zh-CN': '远端服务、账号权限与额度尚未验证', 'en': 'Remote service, permissions, and quota unverified' },
  'diagnostics': { 'zh-CN': '供应商诊断接口', 'en': 'Provider diagnostic support' },
}
const checkDescription = (id: string) => checkDescriptions[id] ? text(checkDescriptions[id]!) : (zh.value ? '其他供应商检查' : 'Additional provider check')
</script>

<template>
  <li class="official-plugin-row" :data-official-plugin="entry.id">
    <div class="official-plugin-heading">
      <strong>{{ entry.name }}</strong>
      <span class="official-plugin-state" :class="{ 'is-ready': state === 'ready' }" role="status" :data-testid="`official-plugin-state-${entry.id}`">{{ labels[state] }}</span>
      <AGUIButton :disabled="loading || !!checking || !provider?.enabled || !provider.diagnostics || readFailed" :loading="checking === entry.id" :aria-label="`${zh ? '检查状态' : 'Check status'} ${entry.name}`" :data-testid="`official-plugin-check-${entry.id}`" @click="emit('check', entry.id)">
        {{ zh ? '检查状态' : 'Check status' }}
      </AGUIButton>
    </div>
    <p class="official-plugin-package">
      {{ entry.packageName }}
    </p>
    <p class="official-plugin-description">
      {{ text(entry.summary) }}
    </p>
    <p class="official-plugin-description">
      {{ text(entry.capabilities) }}
    </p>
    <p class="official-plugin-description">
      <span class="official-plugin-label">{{ zh ? '平台：' : 'Platform: ' }}</span>{{ text(entry.platform) }}
    </p>
    <p v-if="failed" class="official-plugin-error" role="alert">
      {{ zh ? '状态检查未完成，可稍后重试。未执行安装、下载或合成。' : 'The status check did not complete. Retry later. No setup, download, or synthesis was performed.' }}
    </p>
    <p v-if="entry.id === 'openai-tts'" class="official-plugin-description" data-testid="official-openai-scope">
      {{ zh ? '仅检查宿主凭证配置，未验证远端服务、账号权限或额度。' : 'Only host credential configuration is checked. Remote service access, permissions, and quota are unverified.' }}
    </p>
    <ul v-if="diagnosis?.checks.length" class="official-plugin-checks" :aria-label="zh ? `${entry.name} 检查结果` : `${entry.name} check results`">
      <li v-for="check in diagnosis.checks" :key="check.id">
        <span>{{ check.status === 'pass' ? (zh ? '通过' : 'Pass') : check.status === 'warn' ? (zh ? '提示' : 'Note') : (zh ? '未通过' : 'Fail') }} · </span>{{ checkDescription(check.id) }}
      </li>
    </ul>
    <AGUIDetails :title="zh ? '要求与源码接入' : 'Requirements and source setup'" :data-testid="`official-plugin-setup-${entry.id}`">
      <p class="official-plugin-description">
        {{ text(entry.requirements) }}
      </p>
      <p class="official-plugin-description">
        {{ zh ? '以下绝对路径是占位符，请替换成实际目录。共享包、CLI、Editor 和适配器应来自同一份源码。' : 'Replace the absolute path placeholders below. Shared packages, CLI, Editor, and adapter must come from the same source checkout.' }}
      </p>
      <pre class="official-plugin-code"><code>{{ officialPluginInstallCommands(entry) }}</code></pre>
      <p class="official-plugin-description">
        {{ text(entry.preparation) }}
      </p>
      <a class="official-plugin-link" :href="officialPluginSource(entry)" target="_blank" rel="noopener noreferrer">{{ zh ? '配置示例与完整说明' : 'Configuration examples and full guide' }}</a>
    </AGUIDetails>
  </li>
</template>

<style scoped>
.official-plugin-row {
  min-width: 0;
  padding: 10px 0;
  border-top: 1px solid var(--agui-c-divider);
}
.official-plugin-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.official-plugin-state,
.official-plugin-package,
.official-plugin-description,
.official-plugin-checks {
  font-size: 12px;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.official-plugin-package,
.official-plugin-description {
  margin: 4px 0;
}
.official-plugin-package {
  font-family: var(--agui-font-mono, monospace);
}
.official-plugin-label {
  color: var(--agui-c-text-1);
}
.official-plugin-checks {
  margin: 6px 0;
  padding-left: 18px;
}
.official-plugin-state.is-ready {
  color: var(--agui-c-success-text);
}
.official-plugin-error {
  color: var(--agui-c-danger-text);
  font-size: 12px;
}
.official-plugin-code {
  box-sizing: border-box;
  max-width: 100%;
  margin: 8px 0;
  padding: 8px;
  background: var(--agui-c-field);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.official-plugin-link {
  color: var(--agui-c-link);
  font-size: 12px;
}
.official-plugin-link:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 2px;
}
</style>
