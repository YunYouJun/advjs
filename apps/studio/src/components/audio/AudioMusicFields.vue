<script setup lang="ts">
import type { AdvMusicMetadata, AdvMusicUsage } from '@advjs/types'
import { createMusicMetadata, musicUsages } from '@advjs/audio'
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SFormField from '../ui/SFormField.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

const props = defineProps<{ music?: AdvMusicMetadata, license?: string, busy: boolean }>()
const emit = defineEmits<{ usage: [value: AdvMusicUsage] }>()
const { t } = useI18n()
const draft = reactive({ usage: 'background' as AdvMusicUsage, source: 'manual', tool: '', url: '', summary: '', mood: '', style: '', duration: '', tempo: '', instrumental: true, loopIntent: true, notes: '', credit: '', permissionNote: '' })
watch(() => props.music, (music) => {
  Object.assign(draft, { usage: music?.usage ?? 'background', source: music?.source.type ?? 'manual', tool: music?.source.tool ?? '', url: music?.source.url ?? '', summary: music?.brief?.summary ?? '', mood: music?.brief?.mood ?? '', style: music?.brief?.style ?? '', duration: music?.brief?.durationSeconds?.toString() ?? '', tempo: music?.brief?.tempoBpm?.toString() ?? '', instrumental: music?.brief?.instrumental ?? true, loopIntent: music?.brief?.loopIntent ?? (music?.usage ?? 'background') === 'background', notes: music?.brief?.notes ?? '', credit: music?.rights?.credit ?? '', permissionNote: music?.rights?.permissionNote ?? '' })
}, { immediate: true })
watch(() => draft.usage, value => emit('usage', value), { immediate: true })
function read(): AdvMusicMetadata {
  const brief = [draft.summary, draft.mood, draft.style, draft.duration, draft.tempo, draft.notes].some(value => value.trim())
    ? { summary: draft.summary.trim(), ...(draft.mood.trim() ? { mood: draft.mood.trim() } : {}), ...(draft.style.trim() ? { style: draft.style.trim() } : {}), ...(draft.duration ? { durationSeconds: Number(draft.duration) } : {}), ...(draft.tempo ? { tempoBpm: Number(draft.tempo) } : {}), ...(!props.music || props.music.brief?.instrumental !== undefined || !draft.instrumental ? { instrumental: draft.instrumental } : {}), ...(!props.music || props.music.brief?.loopIntent !== undefined || draft.loopIntent !== (props.music.usage === 'background') ? { loopIntent: draft.loopIntent } : {}), ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) }
    : undefined
  return createMusicMetadata({ usage: draft.usage, source: { type: draft.source as AdvMusicMetadata['source']['type'], ...(draft.tool.trim() ? { tool: draft.tool.trim() } : {}), ...(draft.url.trim() ? { url: draft.url.trim() } : {}) }, ...(brief ? { brief } : {}), ...(props.license?.trim() ? { rights: { license: props.license.trim(), ...(draft.credit.trim() ? { credit: draft.credit.trim() } : {}), ...(draft.permissionNote.trim() ? { permissionNote: draft.permissionNote.trim() } : {}) } } : {}) })
}
defineExpose({ read })
</script>

<template>
  <section class="music-fields" data-testid="music-fields">
    <h3>{{ t('musicWorkflow.intentTitle') }}</h3>
    <p>{{ t('musicWorkflow.busHint') }}</p>
    <SFormField :label="t('musicWorkflow.usage')">
      <SSelect v-model="draft.usage" size="lg" :aria-label="t('musicWorkflow.usage')" :disabled="busy" :options="musicUsages.map(value => ({ value, label: t(`musicWorkflow.usages.${value}`) }))" />
    </SFormField>
    <SFormField :label="t('musicWorkflow.source')">
      <SSelect v-model="draft.source" size="lg" :aria-label="t('musicWorkflow.source')" :disabled="busy" :options="['manual', 'external-ai'].map(value => ({ value, label: t(`musicWorkflow.sources.${value}`) }))" />
    </SFormField>
    <SFormField v-if="draft.source === 'external-ai'" :label="t('musicWorkflow.tool')">
      <SInput v-model="draft.tool" size="lg" :aria-label="t('musicWorkflow.tool')" :disabled="busy" placeholder="Suno" />
    </SFormField>
    <SFormField :label="t('musicWorkflow.sourceUrl')" :hint="t('musicWorkflow.sourceUrlHint')">
      <SInput v-model="draft.url" size="lg" inputmode="url" :aria-label="t('musicWorkflow.sourceUrl')" :disabled="busy" />
    </SFormField>
    <label>{{ t('musicWorkflow.summary') }}<textarea v-model="draft.summary" :disabled="busy" maxlength="4096" :aria-label="t('musicWorkflow.summary')" /></label>
    <details>
      <summary>{{ t('musicWorkflow.moreIntent') }}</summary>
      <div class="music-fields__optional">
        <SFormField v-for="field in ['mood', 'style', 'duration', 'tempo', 'credit', 'permissionNote', 'notes'] as const" :key="field" :label="t(`musicWorkflow.${field}`)">
          <SInput v-model="draft[field]" size="lg" :type="field === 'duration' || field === 'tempo' ? 'number' : 'text'" :aria-label="t(`musicWorkflow.${field}`)" :disabled="busy" />
        </SFormField>
        <label class="music-fields__check"><input v-model="draft.instrumental" type="checkbox" :disabled="busy">{{ t('musicWorkflow.instrumental') }}</label>
        <label class="music-fields__check"><input v-model="draft.loopIntent" type="checkbox" :disabled="busy">{{ t('musicWorkflow.loopIntent') }}</label>
        <p>{{ t('musicWorkflow.targetHint') }}</p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.music-fields,
.music-fields__optional {
  display: grid;
  gap: var(--adv-space-md);
  min-width: 0;
}
.music-fields h3,
.music-fields p {
  margin: 0;
}
.music-fields p {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}
.music-fields label {
  display: grid;
  gap: var(--adv-space-xs);
}
.music-fields textarea {
  min-height: 100px;
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  padding: var(--adv-space-sm);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
}
.music-fields textarea:focus-visible,
.music-fields input[type='checkbox']:focus-visible {
  outline: 3px solid var(--adv-primary);
  outline-offset: 2px;
}
.music-fields summary {
  min-height: 44px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--adv-primary);
}
.music-fields .music-fields__check {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: var(--adv-space-sm);
}
.music-fields input[type='checkbox'] {
  width: 24px;
  height: 24px;
  accent-color: var(--adv-primary);
}
</style>
