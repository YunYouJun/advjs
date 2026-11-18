<script setup lang="ts">
import type { VoiceResourceInfo } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'

defineProps<{ resources: VoiceResourceInfo[], pending: boolean }>()
const selected = defineModel<string[]>('selected', { required: true })
const allowShared = defineModel<boolean>('allowShared', { required: true })
const categories = [{ id: 'cache', label: '缓存' }, { id: 'environment', label: '运行环境' }, { id: 'model', label: '模型权重' }]
const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`
function select(id: string, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter(value => value !== id)
}
</script>

<template>
  <div class="ae-resource-selection">
    <AGUIDetails v-for="category in categories" :key="category.id" :title="category.label" open>
      <p v-if="!resources.some(resource => resource.kind === category.id)" class="ae-resource-caption">
        没有登记可管理的资源。
      </p>
      <div v-for="resource in resources.filter(resource => resource.kind === category.id)" :key="resource.id" class="ae-cleanup-resource">
        <AGUICheckbox :checked="selected.includes(resource.id)" :disabled="pending || !resource.available" :label="`${resource.label} · ${size(resource.bytes)}`" :data-resource-id="resource.id" @update:checked="select(resource.id, $event)" />
        <p class="ae-resource-caption ae-resource-path">
          {{ resource.location }}
        </p>
        <p v-if="resource.sharedWith.length" class="ae-resource-caption">
          共享使用：{{ resource.sharedWith.join('、') }}
        </p>
        <p v-if="resource.blockedReason" class="ae-resource-caption">
          {{ resource.blockedReason }}
        </p>
      </div>
    </AGUIDetails>
    <AGUICheckbox v-model:checked="allowShared" :disabled="pending" label="我已核对共享影响，允许清理所选共享资源" data-testid="cleanup-allow-shared" />
  </div>
</template>

<style scoped>
.ae-cleanup-resource {
  margin-block: 6px;
}
.ae-resource-path {
  overflow-wrap: anywhere;
}
</style>
