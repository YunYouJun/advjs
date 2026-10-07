<script setup lang="ts">
import type { ProjectRecoveryStatus } from '../../workspaces/recovery'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed } from 'vue'
import AECopyErrorButton from '../error/AECopyErrorButton.vue'

const props = defineProps<{
  status: ProjectRecoveryStatus | 'local-unavailable'
  projectName?: string
  error?: unknown
}>()
defineEmits<{ retry: [] }>()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const message = computed(() => {
  switch (props.status) {
    case 'restoring':
      return zh.value ? '正在恢复项目…' : 'Restoring project…'
    case 'permission-required':
      return zh.value ? `重新授权以继续编辑「${props.projectName}」。` : `Grant folder access to continue editing “${props.projectName}”.`
    case 'unavailable':
      return zh.value ? `无法打开「${props.projectName}」。请重试或重新选择项目文件夹。` : `Cannot open “${props.projectName}”. Retry or choose the project folder again.`
    case 'local-unavailable':
      return zh.value ? '本地工作区连接失败。请确认 CLI 仍在运行；如果已重启，请使用新的启动链接。' : 'Cannot connect to the local workspace. Check that the CLI is running; if restarted, use its new launch link.'
    default:
      return ''
  }
})
</script>

<template>
  <div v-if="message" class="project-recovery" role="status" :aria-busy="status === 'restoring'">
    <span>{{ message }}</span>
    <AGUIButton v-if="status !== 'restoring'" icon="i-ri-refresh-line" @click="$emit('retry')">
      {{ status === 'permission-required' ? (zh ? '重新授权' : 'Grant access') : (zh ? '重试' : 'Retry') }}
    </AGUIButton>
    <AECopyErrorButton v-if="status === 'unavailable' || status === 'local-unavailable'" source="Project recovery" :error="error ?? message" :details="{ project: projectName, status }" />
  </div>
</template>

<style scoped>
.project-recovery {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-soft);
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.project-recovery span {
  flex: 1 1 180px;
  overflow-wrap: anywhere;
}
</style>
