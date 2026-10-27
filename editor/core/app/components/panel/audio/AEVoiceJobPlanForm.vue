<script setup lang="ts">
import type { VoiceJobsDraft } from '../../../composables/useVoiceJobs'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, shallowRef, useId, watch } from 'vue'

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
const id = useId()
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
    <AGUIProperty label="章节范围">
      <AGUISelect :model-value="modelValue.chapterId" :options="chapters" label="配音章节范围" :disabled="disabled" @update:model-value="update('chapterId', String($event))" />
    </AGUIProperty>
    <AGUIProperty label="生成范围">
      <AGUISelect :model-value="modelValue.mode" :options="[{ value: 'all', label: '全部台词' }, { value: 'missing', label: '仅缺失配音' }, { value: 'stale', label: '仅过期配音' }]" label="配音状态筛选" :disabled="disabled" @update:model-value="update('mode', $event as VoiceJobsDraft['mode'])" />
    </AGUIProperty>
    <AGUIProperty label="合成插件">
      <AGUISelect :model-value="modelValue.providerId" :options="providers" label="任务合成插件" :disabled="disabled" @update:model-value="update('providerId', String($event))" />
    </AGUIProperty>
    <AGUIProperty label="准确语言">
      <AGUISelect :model-value="modelValue.locale" :options="locales" label="任务语言" :disabled="disabled" @update:model-value="update('locale', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-characters`" label="总字符预算上限">
      <AGUIInput :id="`${id}-characters`" :model-value="modelValue.maxCharacters" type="number" min="1" :disabled="disabled" data-testid="jobs-character-budget" @update:model-value="update('maxCharacters', $event)" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-concurrency`" label="任务并发上限">
      <AGUIInput :id="`${id}-concurrency`" :model-value="modelValue.concurrency" type="number" min="1" max="32" :disabled="disabled" @update:model-value="update('concurrency', $event)" />
    </AGUIProperty>
    <AGUICheckbox :checked="modelValue.allowUnknownCost" label="我同意费用无法估算，按上述字符预算执行" :disabled="disabled" data-testid="jobs-unknown-cost" @update:checked="update('allowUnknownCost', Boolean($event))" />
    <p class="ae-resource-caption">
      插件当前未提供费用估算，无法保证金额上限。使用已保存的本地化台词；未提供本地化文本时使用源文本，不自动翻译。
    </p>
    <div class="ae-job-target-heading">
      <span>选择对白 · {{ modelValue.lineIds.length }} / {{ lines.length }}</span>
      <AGUIButton :disabled="disabled || !lines.length || lines.length > maxLines" data-testid="jobs-select-all" @click="update('lineIds', lines.map(line => line.id))">
        全选当前范围
      </AGUIButton>
      <AGUIButton :disabled="disabled || !modelValue.lineIds.length" @click="update('lineIds', [])">
        清空
      </AGUIButton>
    </div>
    <p class="ae-resource-caption">
      每个计划最多 {{ maxLines }} 句<template v-if="batchSize">
        ，自动按每批 {{ batchSize }} 句依次执行
      </template>。预算覆盖整个计划；缺失／过期在审核时按真实文本、音色和词典筛选，缺失指尚未选用配音。
    </p>
    <p v-if="lines.length > maxLines" class="ae-resource-caption" role="status">
      当前范围超过 {{ maxLines }} 句，请选择章节或缩小勾选范围；不会截断全选。
    </p>
    <ul class="ae-job-targets" aria-label="生成对白范围">
      <li v-for="line in visibleLines" :key="line.id">
        <AGUICheckbox :checked="modelValue.lineIds.includes(line.id)" :label="`${line.speakerId} · ${line.text}`" :disabled="disabled || (!modelValue.lineIds.includes(line.id) && modelValue.lineIds.length >= maxLines)" :data-line-id="line.id" @update:checked="select(line.id, Boolean($event))" />
      </li>
    </ul>
    <div v-if="pageCount > 1" class="ae-job-target-heading" aria-label="台词列表分页">
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
  gap: 6px;
  container: agui-properties / inline-size;
}
.ae-job-target-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.ae-job-target-heading > span {
  flex: 1;
}
.ae-job-targets {
  max-height: 220px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
}
.ae-job-targets li {
  padding: 3px 0;
  border-bottom: 1px solid var(--agui-c-divider-light);
}
</style>
