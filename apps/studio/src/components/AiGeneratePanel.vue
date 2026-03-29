<script setup lang="ts">
import type { ContentType } from '../composables/useContentEditor'
import {
  IonButton,
  IonChip,
  IonIcon,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTextarea,
} from '@ionic/vue'
import { checkmarkOutline, sparklesOutline, stopOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiGenerate } from '../composables/useAiGenerate'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import MarkdownMessage from './MarkdownMessage.vue'

const props = defineProps<{
  contentType: ContentType
}>()

const emit = defineEmits<{
  apply: [markdown: string]
}>()

const { t, locale } = useI18n()
const aiSettings = useAiSettingsStore()

const {
  output,
  isGenerating,
  error,
  getSuggestions,
  generate,
  stop,
  clear,
  extractMarkdown,
} = useAiGenerate(props.contentType)

const userPrompt = ref('')
const suggestions = computed(() => getSuggestions(locale.value))

function handleGenerate() {
  if (!userPrompt.value.trim())
    return
  generate(userPrompt.value.trim(), locale.value)
}

function handleSuggestion(suggestion: string) {
  userPrompt.value = suggestion
  generate(suggestion, locale.value)
}

function handleApply() {
  const md = extractMarkdown()
  if (md)
    emit('apply', md)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleGenerate()
  }
}
</script>

<template>
  <div class="agp">
    <!-- Not configured -->
    <div v-if="!aiSettings.isConfigured" class="agp-empty">
      <div class="agp-empty__icon">
        <IonIcon :icon="sparklesOutline" />
      </div>
      <IonNote class="agp-empty__title">
        {{ t('chat.aiNotConfigured') }}
      </IonNote>
      <p class="agp-empty__desc">
        {{ t('chat.aiNotConfiguredDesc') }}
      </p>
    </div>

    <template v-else>
      <!-- Suggestions -->
      <div v-if="!output && !isGenerating" class="agp-suggestions">
        <span class="agp-suggestions__label">{{ t('contentEditor.aiSuggestions') }}</span>
        <div class="agp-suggestions__list">
          <IonChip
            v-for="suggestion in suggestions"
            :key="suggestion"
            class="agp-chip"
            @click="handleSuggestion(suggestion)"
          >
            <IonIcon :icon="sparklesOutline" />
            <IonLabel>{{ suggestion }}</IonLabel>
          </IonChip>
        </div>
      </div>

      <!-- Prompt input -->
      <div class="agp-prompt">
        <IonTextarea
          v-model="userPrompt"
          class="agp-prompt__input"
          :placeholder="t('contentEditor.aiPromptPlaceholder')"
          :auto-grow="true"
          :rows="2"
          @keydown="handleKeydown"
        />
        <div class="agp-prompt__bar">
          <span class="agp-prompt__hint">⌘ Enter</span>
          <IonButton
            v-if="isGenerating"
            fill="outline"
            size="small"
            color="danger"
            class="agp-btn"
            @click="stop"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="start" :icon="stopOutline" />
            {{ t('contentEditor.aiStop') }}
          </IonButton>
          <IonButton
            v-else
            fill="solid"
            size="small"
            class="agp-btn agp-btn--primary"
            :disabled="!userPrompt.trim()"
            @click="handleGenerate"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="start" :icon="sparklesOutline" />
            {{ t('contentEditor.aiGenerate') }}
          </IonButton>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="agp-error">
        <IonNote color="danger">
          {{ error }}
        </IonNote>
      </div>

      <!-- Output -->
      <Transition name="agp-output">
        <div v-if="output || isGenerating" class="agp-output">
          <div class="agp-output__header">
            <IonLabel class="agp-output__title">
              {{ t('contentEditor.aiOutput') }}
            </IonLabel>
            <IonSpinner v-if="isGenerating" name="dots" class="agp-output__spinner" />
          </div>
          <div class="agp-output__body">
            <MarkdownMessage :content="output" :word-wrap="true" />
          </div>
          <Transition name="agp-fade">
            <div v-if="output && !isGenerating" class="agp-output__actions">
              <IonButton fill="solid" size="small" color="success" class="agp-btn" @click="handleApply">
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="start" :icon="checkmarkOutline" />
                {{ t('contentEditor.aiApply') }}
              </IonButton>
              <IonButton fill="outline" size="small" color="medium" class="agp-btn" @click="clear">
                {{ t('contentEditor.aiClear') }}
              </IonButton>
            </div>
          </Transition>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.agp {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

/* Empty state */
.agp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
}

.agp-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #8b5cf6;
  margin-bottom: var(--adv-space-md);
}

.agp-empty__title {
  font-weight: 600;
  font-size: var(--adv-font-body);
}

.agp-empty__desc {
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-body-sm);
  margin: var(--adv-space-xs) 0 0;
  max-width: 260px;
  line-height: 1.5;
}

/* Suggestions */
.agp-suggestions__label {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  display: block;
  margin-bottom: var(--adv-space-sm);
  font-weight: 500;
}

.agp-suggestions__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agp-chip {
  font-size: 12px;
  height: 32px;
  --background: rgba(139, 92, 246, 0.06);
  --color: #8b5cf6;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.agp-chip:hover {
  box-shadow: 0 1px 4px rgba(139, 92, 246, 0.15);
}

.agp-chip ion-icon {
  font-size: 12px;
  margin-right: 2px;
}

/* Prompt */
.agp-prompt {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  overflow: hidden;
  background: var(--adv-surface-card);
  transition: border-color 0.2s ease;
}

.agp-prompt:focus-within {
  border-color: var(--ion-color-primary);
}

.agp-prompt__input {
  --padding-start: var(--adv-space-md);
  --padding-end: var(--adv-space-md);
  --padding-top: var(--adv-space-sm);
  font-size: 14px;
}

.agp-prompt__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--adv-space-xs);
  padding: var(--adv-space-xs) var(--adv-space-sm);
  border-top: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
}

.agp-prompt__hint {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  margin-right: auto;
  font-family: 'SF Mono', monospace;
}

/* Buttons */
.agp-btn {
  --border-radius: var(--adv-radius-md);
  text-transform: none;
  font-weight: 500;
  min-height: 36px;
}

.agp-btn--primary {
  --background: linear-gradient(135deg, #8b5cf6, #6366f1);
}

/* Error */
.agp-error {
  padding: var(--adv-space-sm) var(--adv-space-md);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: var(--adv-radius-md);
}

/* Output */
.agp-output {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  overflow: hidden;
  background: var(--adv-surface-card);
}

.agp-output__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-bottom: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
}

.agp-output__title {
  font-size: 13px;
  font-weight: 600;
}

.agp-output__spinner {
  width: 16px;
  height: 16px;
}

.agp-output__body {
  padding: var(--adv-space-md);
  max-height: 420px;
  overflow-y: auto;
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}

.agp-output__actions {
  display: flex;
  gap: var(--adv-space-xs);
  justify-content: flex-end;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-top: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
}

/* Transitions */
.agp-output-enter-active {
  transition: all 0.3s ease-out;
}
.agp-output-leave-active {
  transition: all 0.2s ease-in;
}
.agp-output-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.agp-output-leave-to {
  opacity: 0;
}

.agp-fade-enter-active {
  transition: opacity 0.2s ease;
}
.agp-fade-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .agp-chip,
  .agp-prompt {
    transition: none;
  }
  .agp-output-enter-active,
  .agp-output-leave-active,
  .agp-fade-enter-active {
    transition: none;
  }
}
</style>
