<script setup lang="ts">
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import AGUIDialog from '@advjs/gui/components/dialog/AGUIDialog.vue'
import AGUITextarea from '@advjs/gui/components/textarea/AGUITextarea.vue'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { useEditorErrorReport } from '../../composables/useEditorErrorReport'

const props = defineProps<{
  source: string
  error?: unknown
  details?: unknown
  logs?: unknown
  label?: string
  copiedLabel?: string
  disabled?: boolean
  compact?: boolean
  report?: string
}>()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const { formatReport, copyReport } = useEditorErrorReport()
const report = computed(() => props.report ?? formatReport(props))
const pending = shallowRef(false)
const copied = shallowRef(false)
const failed = shallowRef(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
const buttonLabel = computed(() => copied.value
  ? props.copiedLabel || (zh.value ? '已复制，可粘贴给 AI' : 'Copied — paste into AI')
  : props.label || (zh.value ? '复制错误信息' : 'Copy error details'))

function resetCopied() {
  clearTimeout(copiedTimer)
  copiedTimer = undefined
  copied.value = false
}

watch(report, () => {
  resetCopied()
  failed.value = false
})
onUnmounted(() => clearTimeout(copiedTimer))

async function copy() {
  if (pending.value)
    return
  pending.value = true
  resetCopied()
  failed.value = false
  const copiedReport = report.value
  try {
    await copyReport(copiedReport)
    copied.value = report.value === copiedReport
    if (props.compact && copied.value)
      copiedTimer = setTimeout(resetCopied, 2000)
  }
  catch {
    failed.value = true
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="copy-error">
    <AGUIIconButton
      v-if="compact"
      :icon="pending ? 'i-svg-spinners:ring-resize' : copied ? 'i-ri-check-line' : 'i-ri-file-copy-line'"
      :title="buttonLabel" :disabled="disabled || pending" :aria-busy="pending || undefined"
      @click="copy"
    />
    <AGUIButton v-else :icon="copied ? 'i-ri-check-line' : 'i-ri-file-copy-line'" :loading="pending" :disabled="disabled" @click="copy">
      {{ buttonLabel }}
    </AGUIButton>
    <AGUIDialog v-if="compact" v-model:open="failed" :title="zh ? '手动复制错误信息' : 'Copy diagnostic report manually'" content-class="w-xl">
      <div class="copy-error-dialog-report">
        <p class="copy-error-message" role="alert">
          {{ zh ? '无法访问剪贴板，请手动复制下方错误信息。' : 'Clipboard access failed. Copy the report below manually.' }}
        </p>
        <AGUITextarea :model-value="report" readonly :aria-label="zh ? '错误排查信息' : 'Error diagnostic report'" :rows="12" />
      </div>
    </AGUIDialog>
    <div v-else-if="failed" class="copy-error-fallback">
      <p class="copy-error-message" role="alert">
        {{ zh ? '无法访问剪贴板，请手动复制下方错误信息。' : 'Clipboard access failed. Copy the report below manually.' }}
      </p>
      <AGUITextarea :model-value="report" readonly :aria-label="zh ? '错误排查信息' : 'Error diagnostic report'" :rows="6" />
    </div>
  </div>
</template>

<style scoped>
.copy-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.copy-error-fallback {
  flex-basis: 100%;
  min-width: 0;
}
.copy-error-dialog-report {
  padding: 8px 12px 12px;
}
.copy-error-message {
  margin: 4px 0;
  font-size: 12px;
  color: var(--agui-c-warning-text);
  overflow-wrap: anywhere;
}
</style>
