<script setup lang="ts">
import type { AdvMusicMetadata } from '@advjs/types'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/components/AGUIProperty.vue'
import AGUIInput from '@advjs/gui/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import AGUITextarea from '@advjs/gui/components/textarea/AGUITextarea.vue'
import { useId } from 'vue'

const props = defineProps<{ modelValue: AdvMusicMetadata, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: AdvMusicMetadata] }>()
const id = useId()
const usages = ['background', 'theme', 'opening', 'ending', 'insert'].map((value, index) => ({ value, label: ['背景音乐', '主题曲', '片头 / OP', '片尾 / ED', '插曲'][index]! }))
function patch(value: Partial<AdvMusicMetadata>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}
function source(value: Partial<AdvMusicMetadata['source']>) {
  patch({ source: { ...props.modelValue.source, ...value } })
}
function rights(value: Partial<NonNullable<AdvMusicMetadata['rights']>>) {
  patch({ rights: { license: '', ...props.modelValue.rights, ...value } })
}
function brief(value: Partial<NonNullable<AdvMusicMetadata['brief']>>) {
  patch({ brief: { summary: '', ...props.modelValue.brief, ...value } })
}
</script>

<template>
  <div class="ae-music-fields">
    <AGUIProperty label="音乐用途">
      <AGUISelect label="音乐用途" :model-value="modelValue.usage" :options="usages" :disabled="disabled" @update:model-value="patch({ usage: $event as AdvMusicMetadata['usage'] })" />
    </AGUIProperty>
    <AGUIProperty label="创作来源">
      <AGUISelect label="音乐创作来源" :model-value="modelValue.source.type" :options="[{ value: 'manual', label: '自主创作 / 已获授权' }, { value: 'external-ai', label: '外部 AI 创作（如 Suno）' }]" :disabled="disabled" @update:model-value="source({ type: $event as AdvMusicMetadata['source']['type'] })" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-tool`" label="工具 / 来源方">
      <AGUIInput :id="`${id}-tool`" :model-value="modelValue.source.tool ?? ''" :disabled="disabled" placeholder="可选，例如 DAW 或 Suno" @update:model-value="source({ tool: $event || undefined })" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-url`" label="来源页面">
      <AGUIInput :id="`${id}-url`" :model-value="modelValue.source.url ?? ''" :disabled="disabled" placeholder="可选，无凭据的 HTTPS 页面" @update:model-value="source({ url: $event || undefined })" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-license`" label="使用许可">
      <AGUIInput :id="`${id}-license`" :model-value="modelValue.rights?.license ?? ''" :disabled="disabled" placeholder="采用前需填写实际许可" @update:model-value="rights({ license: $event })" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-credit`" label="署名">
      <AGUIInput :id="`${id}-credit`" :model-value="modelValue.rights?.credit ?? ''" :disabled="disabled" @update:model-value="rights({ credit: $event || undefined })" />
    </AGUIProperty>
    <AGUIProperty :for="`${id}-permission`" label="授权说明">
      <AGUIInput :id="`${id}-permission`" :model-value="modelValue.rights?.permissionNote ?? ''" :disabled="disabled" placeholder="可选，例如许可范围或订单记录说明" @update:model-value="rights({ permissionNote: $event || undefined })" />
    </AGUIProperty>
    <AGUIDetails title="创作意图与交接内容" :open="Boolean(modelValue.brief)">
      <label :for="`${id}-summary`">创作方案</label>
      <AGUITextarea :id="`${id}-summary`" :model-value="modelValue.brief?.summary ?? ''" :disabled="disabled" :rows="3" placeholder="描述主题、段落、旋律或歌词需求；不代表已生成" @update:model-value="brief({ summary: $event })" />
      <AGUIProperty :for="`${id}-mood`" label="情绪">
        <AGUIInput :id="`${id}-mood`" :model-value="modelValue.brief?.mood ?? ''" :disabled="disabled" @update:model-value="brief({ mood: $event || undefined })" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-style`" label="风格">
        <AGUIInput :id="`${id}-style`" :model-value="modelValue.brief?.style ?? ''" :disabled="disabled" @update:model-value="brief({ style: $event || undefined })" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-duration`" label="目标秒数">
        <AGUIInput :id="`${id}-duration`" type="number" :min="1" :model-value="modelValue.brief?.durationSeconds?.toString() ?? ''" :disabled="disabled" @update:model-value="brief({ durationSeconds: $event ? Number($event) : undefined })" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-tempo`" label="节奏 BPM">
        <AGUIInput :id="`${id}-tempo`" type="number" :min="1" :model-value="modelValue.brief?.tempoBpm?.toString() ?? ''" :disabled="disabled" @update:model-value="brief({ tempoBpm: $event ? Number($event) : undefined })" />
      </AGUIProperty>
      <AGUIProperty label="器乐要求">
        <AGUISelect label="音乐器乐要求" :model-value="modelValue.brief?.instrumental === undefined ? 'unspecified' : String(modelValue.brief.instrumental)" :options="[{ value: 'unspecified', label: '未指定' }, { value: 'true', label: '纯器乐' }, { value: 'false', label: '可包含人声' }]" :disabled="disabled" @update:model-value="brief({ instrumental: $event === 'unspecified' ? undefined : $event === 'true' })" />
      </AGUIProperty>
      <AGUIProperty label="循环意图">
        <AGUISelect label="音乐循环意图" :model-value="modelValue.brief?.loopIntent === undefined ? 'unspecified' : String(modelValue.brief.loopIntent)" :options="[{ value: 'unspecified', label: '未指定' }, { value: 'true', label: '希望可循环' }, { value: 'false', label: '完整曲目' }]" :disabled="disabled" @update:model-value="brief({ loopIntent: $event === 'unspecified' ? undefined : $event === 'true' })" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-notes`" label="补充说明">
        <AGUIInput :id="`${id}-notes`" :model-value="modelValue.brief?.notes ?? ''" :disabled="disabled" @update:model-value="brief({ notes: $event || undefined })" />
      </AGUIProperty>
    </AGUIDetails>
    <p class="ae-resource-caption">
      创作意图不保证实际时长或循环接缝。主题曲、OP、ED 和插曲仍使用 BGM / music 总线；来源页面不是音频播放地址。
    </p>
  </div>
</template>

<style scoped>
.ae-music-fields {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.ae-music-fields :deep(.agui-details-content) {
  display: grid;
  gap: 4px;
}
.ae-music-fields label {
  font-size: 12px;
}
</style>
