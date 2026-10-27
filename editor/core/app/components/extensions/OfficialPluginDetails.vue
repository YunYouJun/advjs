<script setup lang="ts">
import type { OfficialPluginView } from './official-plugin-presentation'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUISection from '@advjs/gui/components/AGUISection.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUICodeBlock from '@advjs/gui/components/code/AGUICodeBlock.vue'
import AGUITag from '@advjs/gui/components/tag/AGUITag.vue'
import { computed } from 'vue'
import { officialPluginInstallCommands, officialPluginSource, officialPluginText } from '../../extensions/official-plugins'
import { officialPluginCheckDescription } from './official-plugin-presentation'

const props = defineProps<{ item: OfficialPluginView, locale: string, loading: boolean, readFailed: boolean, checking: string }>()
defineEmits<{ check: [providerId: string] }>()
const zh = computed(() => props.locale === 'zh-CN')
const text = (value: Parameters<typeof officialPluginText>[0]) => officialPluginText(value, props.locale)
const canCheck = computed(() => !props.loading && !props.readFailed && !props.checking && props.item.provider?.enabled && props.item.provider.diagnostics)
</script>

<template>
  <AGUISection :title="item.entry.name" :description="text(item.entry.summary)" class="official-plugin-details" data-testid="official-plugin-details" :data-selected-plugin="item.entry.id">
    <template #actions>
      <AGUITag :tone="item.status.tone" :data-testid="`official-plugin-detail-state-${item.entry.id}`">
        {{ item.status.label }}
      </AGUITag>
      <AGUIButton :disabled="!canCheck" :loading="checking === item.entry.id" :aria-label="`${zh ? '检查状态' : 'Check status'} ${item.entry.name}`" :data-testid="`official-plugin-check-${item.entry.id}`" @click="$emit('check', item.entry.id)">
        {{ zh ? '检查状态' : 'Check status' }}
      </AGUIButton>
    </template>
    <code class="official-plugin-package">{{ item.entry.packageName }}</code>
    <dl class="official-plugin-properties">
      <div class="official-plugin-property">
        <dt class="official-plugin-property-label">
          {{ zh ? '能力' : 'Capabilities' }}
        </dt>
        <dd class="official-plugin-property-value">
          {{ text(item.entry.capabilities) }}
        </dd>
      </div>
      <div class="official-plugin-property">
        <dt class="official-plugin-property-label">
          {{ zh ? '平台' : 'Platform' }}
        </dt>
        <dd class="official-plugin-property-value">
          {{ text(item.entry.platform) }}
        </dd>
      </div>
    </dl>
    <p v-if="item.failed" class="official-plugin-error" role="alert">
      {{ zh ? '状态检查未完成，可稍后重试。未执行安装、下载或合成。' : 'The status check did not complete. Retry later. No setup, download, or synthesis was performed.' }}
    </p>
    <p v-if="item.entry.id === 'openai-tts'" class="official-plugin-note" data-testid="official-openai-scope">
      {{ zh ? '仅检查宿主凭证配置，未验证远端服务、账号权限或额度。' : 'Only host credential configuration is checked. Remote service access, permissions, and quota are unverified.' }}
    </p>
    <ul v-if="item.diagnosis?.checks.length" class="official-plugin-checks" :aria-label="zh ? `${item.entry.name} 检查结果` : `${item.entry.name} check results`">
      <li v-for="check in item.diagnosis.checks" :key="check.id" class="official-plugin-check">
        <AGUITag :tone="check.status === 'pass' ? 'success' : check.status === 'fail' ? 'danger' : 'warning'">
          {{ check.status === 'pass' ? (zh ? '通过' : 'Pass') : check.status === 'warn' ? (zh ? '提示' : 'Note') : (zh ? '未通过' : 'Fail') }}
        </AGUITag>
        <span>{{ officialPluginCheckDescription(check.id, locale) }}</span>
      </li>
    </ul>
    <AGUIDetails :title="zh ? '运行要求与准备' : 'Requirements and preparation'" :data-testid="`official-plugin-requirements-${item.entry.id}`">
      <p class="official-plugin-note">
        {{ text(item.entry.requirements) }}
      </p>
      <p class="official-plugin-note">
        {{ text(item.entry.preparation) }}
      </p>
    </AGUIDetails>
    <AGUIDetails :title="zh ? '源码构建与本地链接' : 'Build and link from source'" :data-testid="`official-plugin-setup-${item.entry.id}`">
      <p class="official-plugin-note">
        {{ zh ? '绝对路径为占位符，请替换成实际目录。共享包、CLI、Editor 和适配器须来自同一份源码。' : 'Replace the absolute path placeholders. Shared packages, CLI, Editor, and adapter must come from the same source checkout.' }}
      </p>
      <AGUICodeBlock
        :code="officialPluginInstallCommands(item.entry)" :label="zh ? `${item.entry.name} 源码接入命令` : `${item.entry.name} source setup commands`"
        :copy-label="zh ? '复制命令' : 'Copy commands'" :copied-label="zh ? '已复制' : 'Copied'" :copy-error-label="zh ? '复制失败，请手动选择命令' : 'Copy failed. Select the commands manually.'"
      />
    </AGUIDetails>
    <template #footer>
      <a class="official-plugin-link" :href="officialPluginSource(item.entry)" target="_blank" rel="noopener noreferrer">{{ zh ? '配置示例与完整说明' : 'Configuration examples and full guide' }}</a>
      <p class="official-plugin-note">
        {{ zh ? '当前仅提供源码接入。链接包后还需在项目 adv.config.ts 注册供应商。' : 'Source setup only. Register the linked adapter in adv.config.ts.' }}
        {{ item.entry.id === 'openai-tts' ? (zh ? '云端凭证由可信宿主提供。' : 'Provide cloud credentials through the trusted host.') : (zh ? '模型与运行环境单独准备。' : 'Prepare the model and runtime separately.') }}
      </p>
    </template>
  </AGUISection>
</template>

<style scoped>
.official-plugin-details {
  min-width: 0;
}
.official-plugin-package {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  overflow-wrap: anywhere;
}
.official-plugin-properties {
  display: grid;
  gap: var(--agui-space-3);
  margin: 0;
}
.official-plugin-property {
  display: grid;
  gap: var(--agui-space-1);
}
.official-plugin-property-label {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
}
.official-plugin-property-value {
  margin: 0;
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height-reading);
  overflow-wrap: anywhere;
}
.official-plugin-note {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height-reading);
  overflow-wrap: anywhere;
}
.official-plugin-note + .official-plugin-note {
  margin-top: var(--agui-space-2);
}
.official-plugin-error {
  margin: 0;
  color: var(--agui-c-danger-text);
  font-size: var(--agui-font-size-body);
}
.official-plugin-checks {
  display: grid;
  gap: var(--agui-space-2);
  padding: 0;
  margin: 0;
  list-style: none;
}
.official-plugin-check {
  display: flex;
  align-items: flex-start;
  gap: var(--agui-space-2);
  font-size: var(--agui-font-size-body);
  overflow-wrap: anywhere;
}
.official-plugin-check :first-child {
  flex: 0 0 auto;
}
.official-plugin-link {
  justify-self: start;
  color: var(--agui-c-link);
  font-size: var(--agui-font-size-body);
}
.official-plugin-link:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 2px;
  border-radius: var(--agui-radius-sm);
}
</style>
