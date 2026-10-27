<script setup lang="ts">
import type { VoiceJobsDraft } from '../../../composables/useVoiceJobs'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, shallowRef, watch } from 'vue'

const props = defineProps<{
  modelValue: VoiceJobsDraft
  providers: Array<{ value: string, label: string }>
  locales: string[]
  lines: Array<{ id: string, speakerId: string, text: string }>
  chapters: Array<{ value: string, label: string }>
  maxLines: number
  batchSize?: number
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: VoiceJobsDraft] }>()
const page = shallowRef(0)
const pageSize = 100
const pageCount = computed(() => Math.max(1, Math.ceil(props.lines.length / pageSize)))
const visibleLines = computed(() => props.lines.slice(page.value * pageSize, (page.value + 1) * pageSize))
watch(() => props.lines.map(line => line.id).join(','), () => {
  page.value = 0
})
function update<K extends keyof VoiceJobsDraft>(key: K, value: VoiceJobsDraft[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
function select(lineId: string, checked: boolean) {
  update('lineIds', checked ? [...props.modelValue.lineIds, lineId] : props.modelValue.lineIds.filter(id => id !== lineId))
}
</script>

<template>
  <div class="ae-job-fields">
    <div class="ae-job-filterbar" aria-label="配音范围筛选">
      <AGUIProperty class="ae-job-filter" label="章节范围" group>
        <AGUISelect :model-value="modelValue.chapterId" :options="chapters" label="配音章节范围" :disabled="disabled" @update:model-value="update('chapterId', String($event))" />
      </AGUIProperty>
      <AGUIProperty class="ae-job-filter" label="生成范围" group>
        <AGUISelect :model-value="modelValue.mode" :options="[{ value: 'all', label: '全部台词' }, { value: 'missing', label: '仅缺失配音' }, { value: 'stale', label: '仅过期配音' }]" label="配音状态筛选" :disabled="disabled" @update:model-value="update('mode', $event as VoiceJobsDraft['mode'])" />
      </AGUIProperty>
      <AGUIProperty class="ae-job-filter" label="合成插件" group>
        <AGUISelect :model-value="modelValue.providerId" :options="providers" label="任务合成插件" :disabled="disabled" @update:model-value="update('providerId', String($event))" />
      </AGUIProperty>
      <AGUIProperty class="ae-job-filter" label="准确语言" group>
        <AGUISelect :model-value="modelValue.locale" :options="locales" label="任务语言" :disabled="disabled" @update:model-value="update('locale', String($event))" />
      </AGUIProperty>
    </div>
    <div class="ae-job-target-heading">
      <span class="ae-job-selection">已选 <strong>{{ modelValue.lineIds.length }}</strong> / {{ lines.length }} 句</span>
      <div class="ae-job-target-actions">
        <AGUIButton :disabled="disabled || !lines.length || lines.length > maxLines" data-testid="jobs-select-all" @click="update('lineIds', lines.map(line => line.id))">
          全选当前范围
        </AGUIButton>
        <AGUIButton variant="text" :disabled="disabled || !modelValue.lineIds.length" @click="update('lineIds', [])">
          清空
        </AGUIButton>
      </div>
    </div>
    <p class="ae-job-hint">
      缺失／过期会在审核时按真实文本、音色和词典筛选；缺失指尚未选用配音。
    </p>
    <p v-if="lines.length > maxLines" class="ae-job-hint ae-job-warning" role="status">
      当前范围超过 {{ maxLines }} 句，请选择章节或缩小勾选范围；不会截断全选。
    </p>
    <p v-if="!lines.length" class="ae-job-empty" role="status">
      当前范围没有可生成台词，可切换章节或检查稳定行 ID。
    </p>
    <ul v-else class="ae-job-targets" aria-label="生成对白范围">
      <li v-for="line in visibleLines" :key="line.id" class="ae-job-line" :class="{ 'is-selected': modelValue.lineIds.includes(line.id) }">
        <AGUICheckbox class="ae-job-line-choice" :checked="modelValue.lineIds.includes(line.id)" :label="`${line.speakerId} · ${line.text}`" :disabled="disabled || (!modelValue.lineIds.includes(line.id) && modelValue.lineIds.length >= maxLines)" :data-line-id="line.id" @update:checked="select(line.id, Boolean($event))">
          <span class="ae-job-line-copy"><span class="ae-job-line-speaker">{{ line.speakerId }} · </span><span class="ae-job-line-text">{{ line.text }}</span></span>
        </AGUICheckbox>
      </li>
    </ul>
    <div v-if="pageCount > 1" class="ae-job-pagination" aria-label="台词列表分页">
      <AGUIButton :disabled="disabled || page === 0" @click="page--">
        上一页台词
      </AGUIButton>
      <span>{{ page + 1 }} / {{ pageCount }} 页 · 全选包含所有页</span>
      <AGUIButton :disabled="disabled || page + 1 >= pageCount" @click="page++">
        下一页台词
      </AGUIButton>
    </div>
  </div>
</template>

<style scoped>
.ae-job-fields {
  display: grid;
  gap: var(--agui-space-2);
  min-width: 0;
  container: agui-properties / inline-size;
}
.ae-job-filterbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--agui-space-2);
  padding-bottom: var(--agui-space-2);
  border-bottom: 1px solid var(--agui-c-divider-light);
}
.ae-job-filter {
  grid-template-columns: minmax(0, 1fr);
  gap: var(--agui-space-1);
}
.ae-job-filter :deep(.label) {
  text-align: left;
  font-size: var(--agui-font-size-caption);
}
.ae-job-target-heading,
.ae-job-target-actions,
.ae-job-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: var(--agui-space-1);
  align-items: center;
}
.ae-job-target-heading {
  justify-content: space-between;
}
.ae-job-selection,
.ae-job-pagination {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  font-variant-numeric: tabular-nums;
}
.ae-job-selection strong {
  color: var(--agui-c-text-1);
  font-weight: 600;
}
.ae-job-hint {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-warning {
  color: var(--agui-c-warning-text);
}
.ae-job-empty {
  margin: 0;
  padding: var(--agui-space-3);
  border: 1px dashed var(--agui-c-divider);
  border-radius: var(--agui-radius-sm);
  color: var(--agui-c-text-2);
  text-align: center;
}
.ae-job-targets {
  max-height: 208px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-sm);
}
.ae-job-line + .ae-job-line {
  border-top: 1px solid var(--agui-c-divider-light);
}
.ae-job-line.is-selected {
  background: var(--agui-c-bg-soft);
}
.ae-job-line-choice {
  align-items: flex-start;
  gap: var(--agui-space-2);
  padding: var(--agui-space-1) var(--agui-space-2);
  margin: 0;
}
.ae-job-line-copy {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--agui-space-1);
  min-width: 0;
  line-height: var(--agui-line-height);
}
.ae-job-line-speaker {
  color: var(--agui-c-text-2);
}
.ae-job-line-text {
  overflow-wrap: anywhere;
}
.ae-job-pagination {
  justify-content: space-between;
}
@container agui-properties (min-width: 680px) {
  .ae-job-filterbar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@container agui-properties (max-width: 280px) {
  .ae-job-filterbar {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
