<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { inspectMusicReview, musicPlaybackDefaults } from '@advjs/audio'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ operations: unknown, assets: AdvAssetEntry[], busy: boolean }>()
const emit = defineEmits<{ update: [value: Array<Record<string, unknown>>] }>()
const { t } = useI18n()
const rows = computed(() => Array.isArray(props.operations) ? props.operations as Array<Record<string, unknown>> : [])
function edit(index: number, patch: Record<string, unknown>, remove: string[] = []) {
  const next = rows.value.map(row => JSON.parse(JSON.stringify(row)))
  Object.assign(next[index], patch)
  remove.forEach(key => delete next[index][key])
  emit('update', next)
}
function selectAsset(index: number, event: Event) {
  const id = value(event)
  const asset = props.assets.find(asset => asset.id === id)
  edit(index, { asset: id, ...(rows.value[index]?.type === 'bgm' && asset ? { ...musicPlaybackDefaults(asset.music?.usage ?? 'background'), ...(asset.loop !== undefined ? { loop: asset.loop } : {}) } : {}) })
}
function value(event: Event) {
  return (event.target as HTMLInputElement).value
}
function type(index: number, event: Event) {
  const kind = value(event)
  emit('update', rows.value.map((row, i) => i === index ? { type: kind, action: kind === 'sfx' ? 'play' : 'set', ...(kind === 'ambience' ? { slot: 'bed' } : {}) } : row))
}
</script>

<template>
  <section class="flow-audio-fields">
    <p>{{ t('flowEditor.audioHint') }}</p>
    <fieldset v-for="(row, index) in rows" :key="index">
      <legend>{{ t('flowEditor.audioOperation') }} {{ index + 1 }}</legend>
      <div class="flow-fields">
        <label>{{ t('flowEditor.bus') }}<select :value="row.type" :disabled="busy" @change="type(index, $event)"><option v-for="kind in ['bgm', 'ambience', 'sfx']" :key="kind" :value="kind">{{ t(`flowEditor.audioKinds.${kind}`) }}</option></select></label>
        <label v-if="row.type !== 'sfx'">{{ t('flowEditor.action') }}<select :value="row.action" :disabled="busy" @change="edit(index, { action: value($event) }, value($event) === 'clear' ? ['asset', 'gain', 'loop'] : [])"><option value="set">{{ t('flowEditor.set') }}</option><option value="clear">{{ t('flowEditor.clear') }}</option></select></label>
        <label v-if="row.type === 'ambience'">{{ t('flowEditor.slot') }}<select :value="row.slot" :disabled="busy" @change="edit(index, { slot: value($event) })"><option v-for="slot in ['bed', 'weather', 'crowd', 'detail']" :key="slot" :value="slot">{{ slot }}</option></select></label>
        <label v-if="row.action !== 'clear'">{{ t('flowEditor.asset') }}<select :value="row.asset" :disabled="busy" @change="selectAsset(index, $event)"><option value="">{{ t('flowEditor.chooseAsset') }}</option><option v-for="asset in assets.filter(asset => asset.type === 'audio' && asset.kind === row.type && (row.type !== 'bgm' || inspectMusicReview(asset).canBind))" :key="asset.id" :value="asset.id">{{ asset.title ?? asset.id }}</option></select></label>
        <label v-if="row.action !== 'clear'">{{ t('flowEditor.gain') }}<input type="number" min="0" max="1" step="0.05" :value="row.gain ?? 1" :disabled="busy" @change="edit(index, { gain: Number(value($event)) })"></label>
        <label v-if="row.type !== 'sfx' && row.action === 'set'" class="flow-checkbox"><input type="checkbox" :checked="row.loop !== false" :disabled="busy" @change="edit(index, { loop: ($event.target as HTMLInputElement).checked })">{{ t('flowEditor.loop') }}</label>
        <template v-if="row.type !== 'sfx'">
          <label v-for="direction in ['in', 'out']" :key="direction">{{ t(`flowEditor.fade${direction}`) }}<input type="number" min="0" :value="(row.fade as Record<string, unknown> | undefined)?.[direction] ?? 0" :disabled="busy" @change="edit(index, { fade: { ...(row.fade as object ?? {}), [direction]: Number(value($event)) } })"></label>
        </template>
        <template v-else>
          <label>{{ t('flowEditor.group') }}<input :value="row.group" :disabled="busy" @change="edit(index, value($event) ? { group: value($event) } : {}, value($event) ? [] : ['group'])"></label>
          <label>{{ t('flowEditor.priority') }}<input type="number" :value="row.priority ?? 0" :disabled="busy" @change="edit(index, { priority: Number(value($event)) })"></label>
        </template>
      </div>
      <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('update', rows.filter((_, i) => i !== index))">
        {{ t('flowEditor.removeOperation') }}
      </SButton>
    </fieldset>
    <SButton size="lg" variant="outline" :disabled="busy" @click="emit('update', [...rows, { type: 'bgm', action: 'set' }])">
      {{ t('flowEditor.addOperation') }}
    </SButton>
  </section>
</template>
