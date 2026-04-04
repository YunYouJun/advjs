<script setup lang="ts">
import type { ContentType } from '../composables/useContentEditor'
import {
  IonButton,
  IonChip,
  IonIcon,
  IonLabel,
  IonNote,
  IonSpinner,
} from '@ionic/vue'
import { checkmarkOutline, sparklesOutline, stopOutline } from 'ionicons/icons'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiGenerate } from '../composables/useAiGenerate'
import { useStreamingGenerate } from '../composables/useStreamingGenerate'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import MarkdownMessage from './MarkdownMessage.vue'

const props = defineProps<{
  /**
   * Structured content type — when provided, uses useAiGenerate with template
   * system prompts and built-in suggestions.
   */
  contentType?: ContentType
  /**
   * Custom system prompt for free-form generation (used when contentType is
   * omitted). Mutually exclusive with contentType.
   */
  customSystemPrompt?: string
  /**
   * Optional prefix prepended to the user's prompt (e.g. "File: world.md\n\n").
   */
  userPrefix?: string
  /**
   * Override the placeholder text in the textarea.
   */
  placeholder?: string
}>()

const emit = defineEmits<{
  apply: [markdown: string]
}>()

const { t, locale } = useI18n()
const aiSettings = useAiSettingsStore()

// ── Structured mode (with ContentType) ─────────────────────────────────────
const structured = props.contentType
  ? useAiGenerate(props.contentType)
  : null

// ── Custom / free-form mode ─────────────────────────────────────────────────
const streaming = !props.contentType ? useStreamingGenerate() : null

// Unified surface regardless of mode
const output = computed(() => structured ? structured.output.value : streaming!.output.value)
const isGenerating = computed(() => structured ? structured.isGenerating.value : streaming!.isGenerating.value)
const error = computed(() => structured ? structured.error.value : streaming!.error.value)

const suggestions = computed(() =>
  structured ? structured.getSuggestions(locale.value) : [],
)

// ── Local state ─────────────────────────────────────────────────────────────
const userPrompt = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

function autoGrow() {
  const el = textareaRef.value
  if (!el)
    return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(userPrompt, () => nextTick(autoGrow))

// ── Actions ─────────────────────────────────────────────────────────────────
function handleGenerate() {
  const prompt = userPrompt.value.trim()
  if (!prompt)
    return

  if (structured) {
    structured.generate(prompt, locale.value)
  }
  else {
    const systemPrompt
      = props.customSystemPrompt
        ?? (locale.value.startsWith('zh')
          ? '你是 ADV.JS 视觉小说游戏引擎的创作助手。请根据用户的描述生成对应的文件内容，使用 Markdown 格式输出。'
          : 'You are a creative assistant for the ADV.JS visual novel engine. Generate file content based on the user\'s description in Markdown format.')

    const userContent = props.userPrefix ? `${props.userPrefix}${prompt}` : prompt

    streaming!.run([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ])
  }
}

function handleSuggestion(suggestion: string) {
  userPrompt.value = suggestion
  if (structured)
    structured.generate(suggestion, locale.value)
}

function handleApply() {
  if (!output.value)
    return
  const md = structured ? structured.extractMarkdown() : output.value
  if (md)
    emit('apply', md)
}

function handleStop() {
  structured ? structured.stop() : streaming!.stop()
}

function handleClear() {
  structured ? structured.clear() : streaming!.clear()
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
    <!-- ── Not configured ─────────────────────────────────────────── -->
    <div v-if="!aiSettings.isConfigured" class="agp-empty">
      <div class="agp-empty__glow" />
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
      <!-- ── Suggestions ────────────────────────────────────────────── -->
      <Transition name="agp-collapse">
        <div v-if="suggestions.length && !output && !isGenerating" class="agp-suggestions">
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
      </Transition>

      <!-- ── Prompt input ───────────────────────────────────────────── -->
      <div class="agp-prompt">
        <textarea
          id="agp-prompt-input"
          ref="textareaRef"
          v-model="userPrompt"
          name="agp-prompt"
          class="agp-prompt__input"
          :placeholder="placeholder ?? t('contentEditor.aiPromptPlaceholder')"
          rows="2"
          @input="autoGrow"
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
            @click="handleStop"
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

      <!-- ── Error ──────────────────────────────────────────────────── -->
      <Transition name="agp-fade">
        <div v-if="error" class="agp-error">
          <IonNote color="danger">
            {{ error }}
          </IonNote>
        </div>
      </Transition>

      <!-- ── Output ─────────────────────────────────────────────────── -->
      <Transition name="agp-output">
        <div v-if="output || isGenerating" class="agp-output">
          <div class="agp-output__header">
            <IonLabel class="agp-output__title">
              {{ t('contentEditor.aiOutput') }}
            </IonLabel>
            <IonSpinner v-if="isGenerating" name="dots" class="agp-output__spinner" />
          </div>
          <div class="agp-output__body" :class="{ 'agp-output__body--streaming': isGenerating }">
            <MarkdownMessage :content="output" :word-wrap="true" />
          </div>
          <Transition name="agp-fade">
            <div v-if="output && !isGenerating" class="agp-output__actions">
              <IonButton fill="solid" size="small" color="success" class="agp-btn" @click="handleApply">
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="start" :icon="checkmarkOutline" />
                {{ t('contentEditor.aiApply') }}
              </IonButton>
              <IonButton fill="outline" size="small" color="medium" class="agp-btn" @click="handleClear">
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

/* ── Empty / not-configured state ──────────────────────────────── */
.agp-empty {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
  overflow: hidden;
  border-radius: var(--adv-radius-lg);
  border: 1px dashed var(--adv-border-subtle);
}

.agp-empty__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.agp-empty__icon {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
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

/* ── Suggestions ────────────────────────────────────────────────── */
.agp-suggestions__label {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  display: block;
  margin-bottom: var(--adv-space-sm);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.agp-suggestions__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agp-chip {
  font-size: 12px;
  height: 30px;
  --background: rgba(139, 92, 246, 0.06);
  --color: #8b5cf6;
  cursor: pointer;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.agp-chip:hover {
  --background: rgba(139, 92, 246, 0.12);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.18);
  transform: translateY(-1px);
}

.agp-chip:active {
  transform: translateY(0);
}

.agp-chip ion-icon {
  font-size: 12px;
  margin-right: 2px;
}

/* ── Prompt input ────────────────────────────────────────────────── */
.agp-prompt {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  overflow: hidden;
  background: var(--adv-surface-card);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.agp-prompt:focus-within {
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.08);
}

.agp-prompt__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: var(--adv-space-md) var(--adv-space-md) var(--adv-space-sm);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  color: inherit;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
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
  font-family: 'SF Mono', 'Fira Code', monospace;
  opacity: 0.7;
}

/* ── Buttons ─────────────────────────────────────────────────────── */
.agp-btn {
  --border-radius: var(--adv-radius-md);
  text-transform: none;
  font-weight: 500;
  min-height: 34px;
  transition:
    transform 0.1s ease,
    opacity 0.1s ease;
}

.agp-btn:active {
  transform: scale(0.97);
}

.agp-btn--primary {
  --background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  --background-hover: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  --background-activated: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  position: relative;
  overflow: hidden;
}

.agp-btn--primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.12) 100%);
  pointer-events: none;
}

/* ── Error ───────────────────────────────────────────────────────── */
.agp-error {
  padding: var(--adv-space-sm) var(--adv-space-md);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--adv-radius-md);
}

/* ── Output ──────────────────────────────────────────────────────── */
.agp-output {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  overflow: hidden;
  background: var(--adv-surface-card);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
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
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--adv-text-secondary);
}

.agp-output__spinner {
  width: 16px;
  height: 16px;
  color: #8b5cf6;
}

.agp-output__body {
  padding: var(--adv-space-md);
  max-height: 420px;
  overflow-y: auto;
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
  scroll-behavior: smooth;
}

/* Cursor blink while streaming */
.agp-output__body--streaming :deep(p:last-child::after),
.agp-output__body--streaming :deep(li:last-child::after) {
  content: '▋';
  display: inline-block;
  font-size: 0.9em;
  animation: agp-blink 0.8s step-end infinite;
  opacity: 0.8;
  color: #8b5cf6;
  margin-left: 1px;
}

@keyframes agp-blink {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 0;
  }
}

.agp-output__actions {
  display: flex;
  gap: var(--adv-space-xs);
  justify-content: flex-end;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-top: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
}

/* ── Transitions ─────────────────────────────────────────────────── */
.agp-output-enter-active {
  transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.agp-output-leave-active {
  transition: all 0.2s ease-in;
}
.agp-output-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.agp-output-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.agp-fade-enter-active {
  transition: opacity 0.2s ease;
}
.agp-fade-enter-from {
  opacity: 0;
}

.agp-collapse-enter-active,
.agp-collapse-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.agp-collapse-enter-from,
.agp-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}
.agp-collapse-enter-to,
.agp-collapse-leave-from {
  opacity: 1;
  max-height: 200px;
}

@media (prefers-reduced-motion: reduce) {
  .agp-chip,
  .agp-prompt,
  .agp-btn,
  .agp-output-enter-active,
  .agp-output-leave-active,
  .agp-fade-enter-active,
  .agp-collapse-enter-active,
  .agp-collapse-leave-active {
    transition: none;
    animation: none;
  }
}
</style>
