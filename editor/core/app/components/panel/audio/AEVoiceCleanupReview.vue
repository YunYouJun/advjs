<script setup lang="ts">
import type { VoiceCleanupPlan } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'

defineProps<{ plan: VoiceCleanupPlan, pending: boolean }>()
defineEmits<{ execute: [] }>()
const reviewed = defineModel<boolean>('reviewed', { required: true })
</script>

<template>
  <section class="ae-cleanup-review" aria-label="卸载清理审核" data-testid="cleanup-review">
    <p>将停用 {{ plan.providerId }}，清理 {{ plan.resources.length }} 项资源，合计 {{ (plan.totalBytes / 1024 / 1024).toFixed(1) }} MiB。</p>
    <p>保留：{{ plan.preserved.join('、') }}。</p>
    <p class="ae-resource-caption">
      此操作处理供应商停用和本地资源。移除项目配置中的供应商后，再用包管理器卸载插件包：
    </p>
    <code>{{ plan.packageRemovalCommand }}</code>
    <AGUICheckbox v-model:checked="reviewed" :disabled="pending" label="我已核对清理清单和保留范围，确认停用此供应商" data-testid="cleanup-reviewed" />
    <AGUIButton :disabled="pending || !reviewed" :loading="pending" data-testid="cleanup-execute" @click="$emit('execute')">
      确认停用并清理所选资源
    </AGUIButton>
  </section>
</template>

<style scoped>
.ae-cleanup-review {
  border: 1px solid var(--agui-c-divider);
  padding: 8px;
  display: grid;
  gap: 8px;
  overflow-wrap: anywhere;
}
.ae-cleanup-review p {
  margin: 0;
}
</style>
