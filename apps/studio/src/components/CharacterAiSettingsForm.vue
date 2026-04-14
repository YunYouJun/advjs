<script setup lang="ts">
import type { CharacterAiOverride } from '../utils/resolveAiConfig'
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AI_PROVIDERS, useAiSettingsStore } from '../stores/useAiSettingsStore'
import { listTtsProviders } from '../utils/ttsClient'

const props = defineProps<{
  characterId: string
  characterName: string
  override?: CharacterAiOverride
}>()

const emit = defineEmits<{
  save: [config: CharacterAiOverride | undefined]
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()

const useCustom = ref(!!props.override)
const providerId = ref(props.override?.providerId ?? '')
const model = ref(props.override?.model ?? '')
const temperature = ref(props.override?.temperature ?? aiSettings.config.temperature)
const maxTokens = ref(props.override?.maxTokens ?? aiSettings.config.maxTokens)

// TTS override fields
const ttsProvider = ref(props.override?.ttsProvider ?? '')
const ttsVoice = ref(props.override?.ttsVoice ?? '')
const ttsModel = ref(props.override?.ttsModel ?? '')
const ttsSpeed = ref(props.override?.ttsSpeed ?? aiSettings.config.ttsSpeed)

// Reset form when override prop changes
watch(() => props.override, (val) => {
  useCustom.value = !!val
  providerId.value = val?.providerId ?? ''
  model.value = val?.model ?? ''
  temperature.value = val?.temperature ?? aiSettings.config.temperature
  maxTokens.value = val?.maxTokens ?? aiSettings.config.maxTokens
  ttsProvider.value = val?.ttsProvider ?? ''
  ttsVoice.value = val?.ttsVoice ?? ''
  ttsModel.value = val?.ttsModel ?? ''
  ttsSpeed.value = val?.ttsSpeed ?? aiSettings.config.ttsSpeed
})

const selectableProviders = computed(() => {
  return AI_PROVIDERS.filter(p => p.id !== 'custom')
})

const availableModels = computed(() => {
  const pid = providerId.value || aiSettings.config.providerId
  const provider = AI_PROVIDERS.find(p => p.id === pid)
  return provider?.models ?? []
})

const effectiveProvider = computed(() => {
  return providerId.value || aiSettings.config.providerId
})

const effectiveModel = computed(() => {
  return model.value || aiSettings.effectiveModel
})

// TTS computed
const ttsProviders = computed(() => listTtsProviders())

const effectiveTtsProvider = computed(() => {
  const pid = ttsProvider.value || aiSettings.config.ttsProvider
  return ttsProviders.value.find(p => p.id === pid)
})

const availableTtsVoices = computed(() => {
  return effectiveTtsProvider.value?.voices ?? []
})

const availableTtsModels = computed(() => {
  return effectiveTtsProvider.value?.models ?? []
})

const effectiveTtsVoiceLabel = computed(() => {
  return ttsVoice.value || aiSettings.config.ttsVoice || '-'
})

function handleSave() {
  if (!useCustom.value) {
    emit('save', undefined)
    return
  }

  const config: CharacterAiOverride = {}

  // Only include fields that differ from global
  if (providerId.value && providerId.value !== aiSettings.config.providerId)
    config.providerId = providerId.value

  if (model.value && model.value !== aiSettings.effectiveModel)
    config.model = model.value

  if (temperature.value !== aiSettings.config.temperature)
    config.temperature = temperature.value

  if (maxTokens.value !== aiSettings.config.maxTokens)
    config.maxTokens = maxTokens.value

  // TTS override fields — only include if different from global
  if (ttsProvider.value && ttsProvider.value !== aiSettings.config.ttsProvider)
    config.ttsProvider = ttsProvider.value

  if (ttsVoice.value && ttsVoice.value !== aiSettings.config.ttsVoice)
    config.ttsVoice = ttsVoice.value

  if (ttsModel.value && ttsModel.value !== aiSettings.config.ttsModel)
    config.ttsModel = ttsModel.value

  if (ttsSpeed.value !== aiSettings.config.ttsSpeed)
    config.ttsSpeed = ttsSpeed.value

  // If all fields match global, treat as no override
  if (Object.keys(config).length === 0) {
    emit('save', undefined)
    return
  }

  emit('save', config)
}

function handleToggle(val: boolean) {
  useCustom.value = val
  if (!val)
    handleSave()
}
</script>

<template>
  <div class="char-ai-settings">
    <IonList :inset="true">
      <IonListHeader>
        <IonLabel>{{ t('world.aiSettings') }}</IonLabel>
      </IonListHeader>

      <!-- Toggle custom settings -->
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonItem>
        <IonToggle
          :checked="useCustom"
          @ion-change="handleToggle($event.detail.checked)"
        >
          {{ t('world.aiCustomSettings') }}
        </IonToggle>
      </IonItem>

      <template v-if="useCustom">
        <!-- Provider -->
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonItem>
          <IonSelect
            v-model="providerId"
            :label="t('world.aiProvider')"
            :placeholder="t('world.aiUseGlobal', { value: aiSettings.currentProvider.name })"
            interface="popover"
          >
            <IonSelectOption value="">
              {{ t('world.aiUseGlobal', { value: aiSettings.currentProvider.name }) }}
            </IonSelectOption>
            <IonSelectOption
              v-for="provider in selectableProviders"
              :key="provider.id"
              :value="provider.id"
            >
              {{ provider.name }}
            </IonSelectOption>
          </IonSelect>
        </IonItem>

        <!-- Model -->
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonItem>
          <IonSelect
            v-model="model"
            :label="t('world.aiModel')"
            :placeholder="t('world.aiUseGlobal', { value: aiSettings.effectiveModel })"
            interface="popover"
          >
            <IonSelectOption value="">
              {{ t('world.aiUseGlobal', { value: aiSettings.effectiveModel }) }}
            </IonSelectOption>
            <IonSelectOption
              v-for="m in availableModels"
              :key="m"
              :value="m"
            >
              {{ m }}
            </IonSelectOption>
          </IonSelect>
        </IonItem>

        <!-- Temperature -->
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonItem>
          <IonLabel>
            {{ t('world.aiTemperature') }}
            <p>{{ temperature.toFixed(1) }}</p>
          </IonLabel>
          <IonRange
            v-model="temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :pin="true"
            :pin-formatter="(v: number) => v.toFixed(1)"
          />
        </IonItem>

        <!-- Max Tokens -->
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonItem>
          <IonInput
            v-model.number="maxTokens"
            :label="t('world.aiMaxTokens')"
            type="number"
            :min="256"
            :max="32768"
            :placeholder="String(aiSettings.config.maxTokens)"
          />
        </IonItem>
      </template>
    </IonList>

    <!-- TTS Voice Settings (only when custom is on) -->
    <IonList v-if="useCustom" :inset="true">
      <IonListHeader>
        <IonLabel>{{ t('world.ttsVoiceSettings') }}</IonLabel>
      </IonListHeader>

      <!-- TTS Provider -->
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonItem>
        <IonSelect
          v-model="ttsProvider"
          :label="t('world.ttsProviderLabel')"
          :placeholder="t('world.aiUseGlobal', { value: aiSettings.config.ttsProvider })"
          interface="popover"
        >
          <IonSelectOption value="">
            {{ t('world.aiUseGlobal', { value: aiSettings.config.ttsProvider }) }}
          </IonSelectOption>
          <IonSelectOption
            v-for="tp in ttsProviders"
            :key="tp.id"
            :value="tp.id"
          >
            {{ tp.name }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <!-- TTS Voice -->
      <IonItem v-if="availableTtsVoices.length > 0">
        <IonSelect
          v-model="ttsVoice"
          :label="t('world.ttsVoiceLabel')"
          :placeholder="t('world.aiUseGlobal', { value: aiSettings.config.ttsVoice || '-' })"
          interface="popover"
        >
          <IonSelectOption value="">
            {{ t('world.aiUseGlobal', { value: aiSettings.config.ttsVoice || '-' }) }}
          </IonSelectOption>
          <IonSelectOption
            v-for="voice in availableTtsVoices"
            :key="voice"
            :value="voice"
          >
            {{ voice }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <!-- TTS Model -->
      <IonItem v-if="availableTtsModels.length > 0">
        <IonSelect
          v-model="ttsModel"
          :label="t('world.ttsModelLabel')"
          :placeholder="t('world.aiUseGlobal', { value: aiSettings.config.ttsModel || '-' })"
          interface="popover"
        >
          <IonSelectOption value="">
            {{ t('world.aiUseGlobal', { value: aiSettings.config.ttsModel || '-' }) }}
          </IonSelectOption>
          <IonSelectOption
            v-for="m in availableTtsModels"
            :key="m"
            :value="m"
          >
            {{ m }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <!-- TTS Speed -->
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonItem>
        <IonLabel>
          {{ t('world.ttsSpeedLabel') }}
          <p>{{ ttsSpeed.toFixed(1) }}x</p>
        </IonLabel>
        <IonRange
          v-model="ttsSpeed"
          :min="0.5"
          :max="2"
          :step="0.1"
          :pin="true"
          :pin-formatter="(v: number) => `${v.toFixed(1)}x`"
        />
      </IonItem>
    </IonList>

    <!-- Summary -->
    <div v-if="useCustom" class="char-ai-settings__summary">
      <span class="char-ai-settings__label">{{ t('world.aiEffective') }}:</span>
      <span class="char-ai-settings__value">{{ effectiveProvider }} / {{ effectiveModel }} / T={{ temperature.toFixed(1) }}</span>
    </div>
    <div v-if="useCustom && (ttsProvider || ttsVoice)" class="char-ai-settings__summary">
      <span class="char-ai-settings__label">{{ t('world.ttsVoiceSettings') }}:</span>
      <span class="char-ai-settings__value">{{ effectiveTtsProvider?.name ?? '-' }} / {{ effectiveTtsVoiceLabel }} / {{ ttsSpeed.toFixed(1) }}x</span>
    </div>

    <!-- Save button (only when custom is on) -->
    <div v-if="useCustom" class="char-ai-settings__actions">
      <IonButton expand="block" @click="handleSave">
        {{ t('common.save') }}
      </IonButton>
    </div>
  </div>
</template>

<style scoped>
.char-ai-settings {
  padding: var(--adv-space-sm) 0;
}

.char-ai-settings__summary {
  padding: var(--adv-space-sm) var(--adv-space-lg);
  font-size: var(--adv-font-caption, 12px);
  color: var(--adv-text-secondary);
  display: flex;
  gap: var(--adv-space-xs);
  flex-wrap: wrap;
}

.char-ai-settings__label {
  font-weight: 600;
}

.char-ai-settings__value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--adv-text-tertiary);
}

.char-ai-settings__actions {
  padding: var(--adv-space-sm) var(--adv-space-lg);
}
</style>
