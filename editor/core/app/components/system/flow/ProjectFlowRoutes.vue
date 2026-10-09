<script setup lang="ts">
import type { ProjectFlowSource } from '../../../utils/project-flow'
import type { ProjectFlowViewEdge, ProjectFlowViewSelection } from '../../../utils/project-flow-view'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { computed, shallowRef, watch } from 'vue'

const props = defineProps<{ edge?: ProjectFlowViewEdge, zh: boolean, busy: boolean }>()
const emit = defineEmits<{ open: [source?: ProjectFlowSource], navigate: [selection: ProjectFlowViewSelection], close: [], toggle: [] }>()
const page = shallowRef(0)
const pageSize = 50
const pageCount = computed(() => Math.ceil((props.edge?.routes.length ?? 0) / pageSize))
const routes = computed(() => props.edge?.routes.slice(page.value * pageSize, (page.value + 1) * pageSize) ?? [])
watch(() => props.edge, () => {
  page.value = 0
})
</script>

<template>
  <AGUIDetails v-if="edge" class="flow-routes" :title="`${zh ? '跳转明细' : 'Transition details'} · ${edge.routes.length}`" icon="i-ri-git-branch-line" open @toggle="emit('toggle')">
    <div class="route-tools">
      <span v-if="pageCount > 1">{{ page + 1 }} / {{ pageCount }}</span>
      <AGUIIconButton v-if="pageCount > 1" icon="i-ri-arrow-left-s-line" :title="zh ? '上一组跳转' : 'Previous transitions'" :disabled="!page" @click="page--" />
      <AGUIIconButton v-if="pageCount > 1" icon="i-ri-arrow-right-s-line" :title="zh ? '下一组跳转' : 'Next transitions'" :disabled="page + 1 >= pageCount" @click="page++" />
      <AGUIIconButton icon="i-ri-close-line" :title="zh ? '关闭跳转明细' : 'Close transitions'" @click="emit('close')" />
    </div>
    <ol class="route-list">
      <li v-for="route in routes" :key="route.edge.id" class="route" :data-flow-route="route.edge.id">
        <div class="route-heading">
          <AGUIButton variant="text" :disabled="busy || !route.source.source" :aria-label="`${zh ? '定位跳转源码：' : 'Open transition source: '}${route.source.label}`" @click="emit('open', route.source.source)">
            {{ route.source.label }}
          </AGUIButton>
          <span aria-hidden="true">→</span>
          <AGUIButton variant="text" :disabled="busy" :aria-label="`${zh ? '展开跳转目标：' : 'Expand destination: '}${route.target.label}`" @click="emit('navigate', route.targetSelection)">
            {{ route.target.label }}
          </AGUIButton>
        </div>
        <p class="route-meta">
          <span v-if="route.edge.label">{{ route.edge.label }} · </span>
          <span v-if="route.edge.conditional">{{ zh ? '有条件 · ' : 'Conditional · ' }}</span>
          {{ route.source.source?.path }}:{{ route.source.source?.line }} → {{ route.target.source?.path }}:{{ route.target.source?.line }}
        </p>
      </li>
    </ol>
  </AGUIDetails>
</template>

<style scoped>
.flow-routes {
  flex: 0 0 auto;
  max-height: 35%;
  overflow: auto;
  border-top: 1px solid var(--agui-c-divider);
  font-size: 12px;
}
.route-tools {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
}
.route-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.route {
  padding: 4px 0;
  border-top: 1px solid var(--agui-c-divider);
}
.route-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.route-heading :deep(.agui-button) {
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}
.route-meta {
  margin: 2px 0;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
</style>
