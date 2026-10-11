<script setup lang="ts">
import type { AudioBus, AudioMixerConfig } from '@advjs/types'
import { audioBuses, parseAudioMixerConfig } from '@advjs/audio'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ mixer: AudioMixerConfig, revision: string, busy: boolean }>()
const emit = defineEmits<{ save: [mixer: AudioMixerConfig] }>()
const { t } = useI18n()
const draft = ref<AudioMixerConfig>({ schemaVersion: 1 })
const error = ref('')
const changed = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.mixer))
watch(() => props.revision, () => {
  draft.value = JSON.parse(JSON.stringify(props.mixer))
  error.value = ''
}, { immediate: true })

function setBus(bus: AudioBus, key: 'gain' | 'muted' | 'solo', value: number | boolean) {
  draft.value = { ...draft.value, buses: { ...draft.value.buses, [bus]: { ...draft.value.buses?.[bus], [key]: value } } }
}

function setDucking(key: 'enabled' | 'gain' | 'attackMs' | 'releaseMs', value: number | boolean) {
  draft.value = { ...draft.value, ducking: { ...draft.value.ducking, [key]: value } }
}

function save() {
  try {
    emit('save', parseAudioMixerConfig(JSON.parse(JSON.stringify(draft.value))))
    error.value = ''
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <section class="mixer-panel" aria-labelledby="mixer-title">
    <h2 id="mixer-title" class="mixer-panel__title">
      {{ t('audioWorkspace.mixerTitle') }}
    </h2>
    <p class="mixer-panel__hint">
      {{ t('audioWorkspace.mixerHint') }}
    </p>
    <div v-for="bus in audioBuses" :key="bus" class="mixer-panel__bus">
      <label :for="`mixer-gain-${bus}`" class="mixer-panel__label">{{ t(`audioWorkspace.bus.${bus}`) }}</label>
      <output :for="`mixer-gain-${bus}`">{{ Math.round((draft.buses?.[bus]?.gain ?? 1) * 100) }}%</output>
      <input
        :id="`mixer-gain-${bus}`"
        type="range" min="0" max="1" step="0.01"
        :value="draft.buses?.[bus]?.gain ?? 1" :disabled="busy"
        @input="setBus(bus, 'gain', Number(($event.target as HTMLInputElement).value))"
      >
      <div class="mixer-panel__toggles">
        <label><input type="checkbox" :checked="draft.buses?.[bus]?.muted ?? false" :disabled="busy" @change="setBus(bus, 'muted', ($event.target as HTMLInputElement).checked)">{{ t('audioWorkspace.mute') }}</label>
        <label><input type="checkbox" :checked="draft.buses?.[bus]?.solo ?? false" :disabled="busy" @change="setBus(bus, 'solo', ($event.target as HTMLInputElement).checked)">{{ t('audioWorkspace.solo') }}</label>
      </div>
    </div>
    <fieldset class="mixer-panel__ducking" :disabled="busy">
      <legend>{{ t('audioWorkspace.ducking') }}</legend>
      <label class="mixer-panel__toggle"><input type="checkbox" :checked="draft.ducking?.enabled ?? true" @change="setDucking('enabled', ($event.target as HTMLInputElement).checked)">{{ t('audioWorkspace.duckingEnabled') }}</label>
      <label class="mixer-panel__number">{{ t('audioWorkspace.duckGain') }}<input type="number" min="0" max="1" step="0.01" :value="draft.ducking?.gain ?? 0.35" @input="setDucking('gain', Number(($event.target as HTMLInputElement).value))"></label>
      <label class="mixer-panel__number">{{ t('audioWorkspace.attack') }}<input type="number" min="0" max="60000" :value="draft.ducking?.attackMs ?? 120" @input="setDucking('attackMs', Number(($event.target as HTMLInputElement).value))"></label>
      <label class="mixer-panel__number">{{ t('audioWorkspace.release') }}<input type="number" min="0" max="60000" :value="draft.ducking?.releaseMs ?? 300" @input="setDucking('releaseMs', Number(($event.target as HTMLInputElement).value))"></label>
    </fieldset>
    <p v-if="error" class="mixer-panel__error" role="alert">
      {{ error }}
    </p>
    <SButton size="lg" :loading="busy" :disabled="!changed" @click="save">
      {{ t('audioWorkspace.saveMixer') }}
    </SButton>
  </section>
</template>

<style scoped>
.mixer-panel {
  display: grid;
  gap: var(--adv-space-md);
}
.mixer-panel__title {
  margin: 0;
  font-size: var(--adv-font-title);
}
.mixer-panel__hint {
  margin: 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
.mixer-panel__bus {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  border-bottom: 1px solid var(--adv-border-subtle);
  padding-bottom: 8px;
}
.mixer-panel__label {
  font-weight: 600;
}
.mixer-panel__bus > input {
  grid-column: 1 / -1;
  width: 100%;
  min-height: 44px;
  accent-color: var(--adv-primary);
}
.mixer-panel__toggles {
  grid-column: 1 / -1;
  display: flex;
  gap: 24px;
}
.mixer-panel__toggles label,
.mixer-panel__toggle {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mixer-panel__ducking {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
}
.mixer-panel__number {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
}
.mixer-panel__number input {
  width: 100px;
  min-height: 44px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  padding: 8px;
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
}
.mixer-panel__error {
  color: var(--adv-danger);
}
input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
  outline-offset: 2px;
}
</style>
