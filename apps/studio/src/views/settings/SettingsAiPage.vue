<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  checkmarkCircleOutline,
  chevronDownOutline,
  chevronUpOutline,
  closeCircleOutline,
  flashOutline,
  imageOutline,
  keyOutline,
  lockClosedOutline,
  openOutline,
  searchOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  volumeHighOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AI_PROVIDERS, useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { testAiConnection } from '../../utils/aiClient'
import { EMBEDDING_PROVIDERS } from '../../utils/embeddingClient'
import { getWebSpeechVoices, listTtsProviders } from '../../utils/ttsClient'

const { t } = useI18n()
const aiStore = useAiSettingsStore()

const isTesting = ref(false)
const testResult = ref<'idle' | 'success' | 'failed'>('idle')
const testError = ref('')
const isAdvancedExpanded = ref(false)
const isImageExpanded = ref(false)
const isTtsExpanded = ref(false)
const isEmbeddingExpanded = ref(false)
const webSpeechVoices = ref<SpeechSynthesisVoice[]>([])

const ttsProviders = computed(() => listTtsProviders())

const currentTtsProvider = computed(() => {
  return ttsProviders.value.find(p => p.id === aiStore.config.ttsProvider)
})

const ttsNeedsKey = computed(() => {
  return currentTtsProvider.value?.needsKey !== false
})

const ttsAvailableModels = computed(() => {
  return currentTtsProvider.value?.models ?? []
})

const ttsAvailableVoices = computed(() => {
  if (aiStore.config.ttsProvider === 'web-speech')
    return webSpeechVoices.value.map(v => v.name)
  return currentTtsProvider.value?.voices ?? []
})

const currentEmbeddingProvider = computed(() => {
  return EMBEDDING_PROVIDERS.find(p => p.id === aiStore.config.embeddingProvider)
})

const embeddingAvailableModels = computed(() => {
  return currentEmbeddingProvider.value?.models ?? []
})

onMounted(async () => {
  if (typeof speechSynthesis !== 'undefined') {
    webSpeechVoices.value = await getWebSpeechVoices()
  }
})

const providerNeedsKey = computed(() => {
  return aiStore.currentProvider.needsKey !== false
})

async function handleTestConnection() {
  if (!aiStore.isConfigured)
    return

  isTesting.value = true
  testResult.value = 'idle'
  testError.value = ''

  try {
    await testAiConnection({
      baseURL: aiStore.effectiveBaseURL,
      apiKey: aiStore.config.apiKey,
      model: aiStore.effectiveModel,
    })
    testResult.value = 'success'
  }
  catch (err) {
    testResult.value = 'failed'
    testError.value = err instanceof Error ? err.message : 'Unknown error'
  }
  finally {
    isTesting.value = false
  }
}

function selectProvider(providerId: string) {
  aiStore.setProvider(providerId)
  testResult.value = 'idle'
  testError.value = ''
}

const IMAGE_PROVIDERS = [
  { id: 'none', name: 'None' },
  { id: 'runware', name: 'Runware' },
  { id: 'hunyuan', name: 'Hunyuan' },
  { id: 'siliconflow', name: 'SiliconFlow' },
  { id: 'openai-dall-e', name: 'DALL-E' },
] as const
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me/settings" />
        </IonButtons>
        <IonTitle>{{ t('settings.ai') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.ai') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- Hero Banner -->
        <div class="hero-banner">
          <div class="hero-banner__icon">
            <IonIcon :icon="sparklesOutline" />
          </div>
          <p class="hero-banner__desc">
            {{ t('settings.aiDesc') }}
          </p>
        </div>

        <!-- Provider Selection Card -->
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__icon section-card__icon--provider">
              <IonIcon :icon="flashOutline" />
            </div>
            <h3 class="section-card__title">
              {{ t('settings.aiProvider') }}
            </h3>
          </div>

          <div class="provider-grid">
            <button
              v-for="provider in AI_PROVIDERS"
              :key="provider.id"
              class="provider-chip"
              :class="{ 'provider-chip--active': aiStore.config.providerId === provider.id }"
              @click="selectProvider(provider.id)"
            >
              <span class="provider-chip__name">{{ provider.name }}</span>
              <span v-if="provider.needsKey === false" class="provider-chip__badge">{{ t('settings.aiNoKey') }}</span>
            </button>
          </div>

          <!-- Registration Link -->
          <a
            v-if="aiStore.currentProvider.registrationUrl"
            :href="aiStore.currentProvider.registrationUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="registration-link"
          >
            {{ t('settings.aiGetKey', { provider: aiStore.currentProvider.name }) }}
            <IonIcon :icon="openOutline" class="registration-link__icon" />
          </a>
        </div>

        <!-- Credentials Card -->
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__icon section-card__icon--key">
              <IonIcon :icon="keyOutline" />
            </div>
            <h3 class="section-card__title">
              {{ t('settings.aiConfiguration') }}
            </h3>
          </div>

          <div class="form-group">
            <!-- API Key (if needed) -->
            <div v-if="providerNeedsKey" class="input-field">
              <label class="input-field__label">
                <IonIcon :icon="lockClosedOutline" class="input-field__label-icon" />
                {{ t('settings.aiApiKey') }}
              </label>
              <input
                v-model.trim="aiStore.config.apiKey"
                class="input-field__input"
                type="password"
                placeholder="sk-..."
                autocomplete="off"
              >
            </div>

            <!-- Custom Base URL (for custom provider) -->
            <div v-if="aiStore.config.providerId === 'custom'" class="input-field">
              <label class="input-field__label">
                {{ t('settings.aiBaseURL') }}
              </label>
              <input
                v-model.trim="aiStore.config.customBaseURL"
                class="input-field__input"
                type="url"
                placeholder="https://api.example.com/v1"
                autocomplete="off"
              >
            </div>

            <!-- Model Selection -->
            <div class="input-field">
              <label class="input-field__label">
                {{ t('settings.aiModel') }}
              </label>
              <div v-if="aiStore.availableModels.length > 0" class="model-chips">
                <button
                  v-for="model in aiStore.availableModels"
                  :key="model"
                  class="model-chip"
                  :class="{ 'model-chip--active': aiStore.config.model === model }"
                  @click="aiStore.config.model = model"
                >
                  {{ model }}
                </button>
              </div>
              <input
                v-if="aiStore.config.providerId === 'custom'"
                v-model.trim="aiStore.config.customModel"
                class="input-field__input"
                type="text"
                placeholder="model-name"
                autocomplete="off"
              >
            </div>
          </div>

          <!-- Test Connection -->
          <button
            class="test-btn"
            :class="{
              'test-btn--success': testResult === 'success',
              'test-btn--failed': testResult === 'failed',
              'test-btn--loading': isTesting,
            }"
            :disabled="isTesting || !aiStore.isConfigured"
            @click="handleTestConnection"
          >
            <IonSpinner v-if="isTesting" name="crescent" class="test-btn__spinner" />
            <IonIcon v-else-if="testResult === 'success'" :icon="checkmarkCircleOutline" />
            <IonIcon v-else-if="testResult === 'failed'" :icon="closeCircleOutline" />
            <IonIcon v-else :icon="shieldCheckmarkOutline" />
            <span>
              {{ isTesting
                ? t('settings.testing')
                : testResult === 'success'
                  ? t('settings.testSuccess')
                  : t('settings.aiTestConnection')
              }}
            </span>
          </button>

          <p v-if="testResult === 'failed'" class="test-error">
            {{ testError }}
          </p>
        </div>

        <!-- Advanced Settings (Collapsible) -->
        <button class="guide-toggle" @click="isAdvancedExpanded = !isAdvancedExpanded">
          <span class="guide-toggle__label">
            <IonIcon :icon="settingsOutline" />
            {{ t('settings.aiAdvanced') }}
          </span>
          <IonIcon :icon="isAdvancedExpanded ? chevronUpOutline : chevronDownOutline" />
        </button>

        <Transition name="guide">
          <div v-show="isAdvancedExpanded" class="section-card">
            <div class="form-group">
              <!-- Temperature -->
              <div class="input-field">
                <label class="input-field__label">
                  {{ t('settings.aiTemperature') }}
                  <span class="input-field__value">{{ aiStore.config.temperature.toFixed(1) }}</span>
                </label>
                <input
                  v-model.number="aiStore.config.temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  class="range-input"
                >
                <span class="input-field__hint">{{ t('settings.aiTemperatureHint') }}</span>
              </div>

              <!-- Max Tokens -->
              <div class="input-field">
                <label class="input-field__label">
                  {{ t('settings.aiMaxTokens') }}
                </label>
                <input
                  v-model.number="aiStore.config.maxTokens"
                  class="input-field__input"
                  type="number"
                  min="256"
                  max="32768"
                  step="256"
                >
              </div>

              <!-- System Prompt -->
              <div class="input-field">
                <label class="input-field__label">
                  {{ t('settings.aiSystemPrompt') }}
                </label>
                <textarea
                  v-model="aiStore.config.systemPrompt"
                  class="input-field__textarea"
                  rows="4"
                  :placeholder="t('settings.aiSystemPromptPlaceholder')"
                />
              </div>
            </div>
          </div>
        </Transition>

        <!-- Image Generation (Collapsible) -->
        <button class="guide-toggle" @click="isImageExpanded = !isImageExpanded">
          <span class="guide-toggle__label">
            <IonIcon :icon="imageOutline" />
            {{ t('settings.aiImageGeneration') }}
          </span>
          <IonIcon :icon="isImageExpanded ? chevronUpOutline : chevronDownOutline" />
        </button>

        <Transition name="guide">
          <div v-show="isImageExpanded" class="section-card">
            <div class="section-card__header">
              <div class="section-card__icon section-card__icon--image">
                <IonIcon :icon="imageOutline" />
              </div>
              <h3 class="section-card__title">
                {{ t('settings.aiImageProvider') }}
              </h3>
            </div>

            <div class="provider-grid">
              <button
                v-for="ip in IMAGE_PROVIDERS"
                :key="ip.id"
                class="provider-chip"
                :class="{ 'provider-chip--active': aiStore.config.imageProvider === ip.id }"
                @click="(aiStore.config.imageProvider as string) = ip.id"
              >
                <span class="provider-chip__name">{{ ip.name }}</span>
              </button>
            </div>

            <div v-if="aiStore.config.imageProvider !== 'none'" class="form-group">
              <div class="input-field">
                <label class="input-field__label">
                  <IonIcon :icon="lockClosedOutline" class="input-field__label-icon" />
                  {{ t('settings.aiImageApiKey') }}
                </label>
                <input
                  v-model.trim="aiStore.config.imageApiKey"
                  class="input-field__input"
                  type="password"
                  placeholder="sk-..."
                  autocomplete="off"
                >
              </div>

              <div class="input-field">
                <label class="input-field__label">
                  {{ t('settings.aiImageModel') }}
                </label>
                <input
                  v-model.trim="aiStore.config.imageModel"
                  class="input-field__input"
                  type="text"
                  placeholder="model-name"
                  autocomplete="off"
                >
              </div>
            </div>

            <p class="image-hint">
              {{ t('settings.aiImageHint') }}
            </p>
          </div>
        </Transition>

        <!-- TTS Settings (Collapsible) -->
        <button class="guide-toggle" @click="isTtsExpanded = !isTtsExpanded">
          <span class="guide-toggle__label">
            <IonIcon :icon="volumeHighOutline" />
            {{ t('settings.tts') }}
          </span>
          <IonIcon :icon="isTtsExpanded ? chevronUpOutline : chevronDownOutline" />
        </button>

        <Transition name="guide">
          <div v-show="isTtsExpanded" class="section-card">
            <div class="section-card__header">
              <div class="section-card__icon section-card__icon--tts">
                <IonIcon :icon="volumeHighOutline" />
              </div>
              <h3 class="section-card__title">
                {{ t('settings.ttsProvider') }}
              </h3>
            </div>

            <div class="provider-grid">
              <button
                v-for="tp in ttsProviders"
                :key="tp.id"
                class="provider-chip"
                :class="{ 'provider-chip--active': aiStore.config.ttsProvider === tp.id }"
                @click="aiStore.config.ttsProvider = tp.id"
              >
                <span class="provider-chip__name">{{ tp.name }}</span>
                <span v-if="!tp.needsKey" class="provider-chip__badge">{{ t('settings.aiNoKey') }}</span>
              </button>
            </div>

            <!-- Registration Link -->
            <a
              v-if="currentTtsProvider?.registrationUrl"
              :href="currentTtsProvider.registrationUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="registration-link"
            >
              {{ t('settings.aiGetKey', { provider: currentTtsProvider.name }) }}
              <IonIcon :icon="openOutline" class="registration-link__icon" />
            </a>

            <div class="form-group">
              <!-- TTS API Key -->
              <div v-if="ttsNeedsKey" class="input-field">
                <label class="input-field__label">
                  <IonIcon :icon="lockClosedOutline" class="input-field__label-icon" />
                  {{ t('settings.ttsApiKey') }}
                </label>
                <input
                  v-model.trim="aiStore.config.ttsApiKey"
                  class="input-field__input"
                  type="password"
                  placeholder="sk-..."
                  autocomplete="off"
                >
              </div>

              <!-- Custom Base URL -->
              <div v-if="aiStore.config.ttsProvider === 'custom'" class="input-field">
                <label class="input-field__label">
                  {{ t('settings.ttsCustomBaseURL') }}
                </label>
                <input
                  v-model.trim="aiStore.config.ttsCustomBaseURL"
                  class="input-field__input"
                  type="url"
                  placeholder="https://api.example.com/v1"
                  autocomplete="off"
                >
              </div>

              <!-- TTS Model -->
              <div v-if="ttsAvailableModels.length > 0" class="input-field">
                <label class="input-field__label">
                  {{ t('settings.ttsModel') }}
                </label>
                <div class="model-chips">
                  <button
                    v-for="model in ttsAvailableModels"
                    :key="model"
                    class="model-chip"
                    :class="{ 'model-chip--active': aiStore.config.ttsModel === model }"
                    @click="aiStore.config.ttsModel = model"
                  >
                    {{ model }}
                  </button>
                </div>
              </div>

              <!-- TTS Voice -->
              <div v-if="ttsAvailableVoices.length > 0" class="input-field">
                <label class="input-field__label">
                  {{ t('settings.ttsVoice') }}
                </label>
                <div class="model-chips">
                  <button
                    v-for="voice in ttsAvailableVoices"
                    :key="voice"
                    class="model-chip"
                    :class="{ 'model-chip--active': aiStore.config.ttsVoice === voice }"
                    @click="aiStore.config.ttsVoice = voice"
                  >
                    {{ voice }}
                  </button>
                </div>
              </div>

              <!-- TTS Speed -->
              <div class="input-field">
                <label class="input-field__label">
                  {{ t('settings.ttsSpeed') }}
                  <span class="input-field__value">{{ aiStore.config.ttsSpeed.toFixed(1) }}</span>
                </label>
                <input
                  v-model.number="aiStore.config.ttsSpeed"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  class="range-input"
                >
                <span class="input-field__hint">{{ t('settings.ttsSpeedHint') }}</span>
              </div>
            </div>

            <p class="image-hint">
              {{ t('settings.ttsHint') }}
            </p>
          </div>
        </Transition>

        <!-- Embedding Settings (Collapsible) -->
        <button class="guide-toggle" @click="isEmbeddingExpanded = !isEmbeddingExpanded">
          <span class="guide-toggle__label">
            <IonIcon :icon="searchOutline" />
            {{ t('settings.embedding') }}
          </span>
          <IonIcon :icon="isEmbeddingExpanded ? chevronUpOutline : chevronDownOutline" />
        </button>

        <Transition name="guide">
          <div v-show="isEmbeddingExpanded" class="section-card">
            <div class="section-card__header">
              <div class="section-card__icon section-card__icon--embedding">
                <IonIcon :icon="searchOutline" />
              </div>
              <h3 class="section-card__title">
                {{ t('settings.embedding') }}
              </h3>
            </div>

            <!-- Enable toggle -->
            <label class="toggle-row">
              <span class="toggle-row__label">{{ t('settings.embeddingEnabled') }}</span>
              <input
                v-model="aiStore.config.embeddingEnabled"
                type="checkbox"
                class="toggle-checkbox"
              >
            </label>
            <p class="image-hint">
              {{ t('settings.embeddingEnabledHint') }}
            </p>

            <template v-if="aiStore.config.embeddingEnabled">
              <div class="provider-grid">
                <button
                  v-for="ep in EMBEDDING_PROVIDERS"
                  :key="ep.id"
                  class="provider-chip"
                  :class="{ 'provider-chip--active': aiStore.config.embeddingProvider === ep.id }"
                  @click="aiStore.config.embeddingProvider = ep.id"
                >
                  <span class="provider-chip__name">{{ ep.name }}</span>
                  <span v-if="!ep.needsKey" class="provider-chip__badge">{{ t('settings.aiNoKey') }}</span>
                </button>
              </div>

              <div v-if="aiStore.config.embeddingProvider !== 'same'" class="form-group">
                <div v-if="currentEmbeddingProvider?.needsKey" class="input-field">
                  <label class="input-field__label">
                    <IonIcon :icon="lockClosedOutline" class="input-field__label-icon" />
                    {{ t('settings.embeddingApiKey') }}
                  </label>
                  <input
                    v-model.trim="aiStore.config.embeddingApiKey"
                    class="input-field__input"
                    type="password"
                    placeholder="sk-..."
                    autocomplete="off"
                  >
                </div>

                <div v-if="aiStore.config.embeddingProvider === 'custom'" class="input-field">
                  <label class="input-field__label">
                    {{ t('settings.embeddingCustomBaseURL') }}
                  </label>
                  <input
                    v-model.trim="aiStore.config.embeddingCustomBaseURL"
                    class="input-field__input"
                    type="url"
                    placeholder="https://api.example.com/v1"
                    autocomplete="off"
                  >
                </div>

                <div v-if="embeddingAvailableModels.length > 0" class="input-field">
                  <label class="input-field__label">
                    {{ t('settings.embeddingModel') }}
                  </label>
                  <div class="model-chips">
                    <button
                      v-for="model in embeddingAvailableModels"
                      :key="model"
                      class="model-chip"
                      :class="{ 'model-chip--active': aiStore.config.embeddingModel === model }"
                      @click="aiStore.config.embeddingModel = model"
                    >
                      {{ model }}
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <p class="image-hint">
              {{ t('settings.embeddingHint') }}
            </p>
          </div>
        </Transition>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}

/* ── Hero Banner ── */
.hero-banner {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md) var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-surface);
  border: 1px solid rgba(139, 92, 246, 0.12);
}

.hero-banner__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--adv-radius-md);
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 22px;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.hero-banner__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* ── Section Card ── */
.section-card {
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.section-card__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
}

.section-card__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--adv-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.section-card__icon--provider {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.section-card__icon--key {
  background: rgba(99, 102, 241, 0.1);
  color: var(--ion-color-primary);
}

.section-card__icon--image {
  background: rgba(236, 72, 153, 0.1);
  color: #ec4899;
}

.section-card__icon--tts {
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
}

.section-card__icon--embedding {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

/* ── Toggle Row ── */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-xs) 0;
  cursor: pointer;
}

.toggle-row__label {
  font-size: var(--adv-font-body);
  font-weight: 500;
  color: var(--adv-text-primary);
}

.toggle-checkbox {
  width: 44px;
  height: 24px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--adv-border-subtle);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-checkbox::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-checkbox:checked {
  background: var(--ion-color-primary);
}

.toggle-checkbox:checked::before {
  transform: translateX(20px);
}

.section-card__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  margin: 0;
}

/* ── Provider Grid ── */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--adv-space-xs);
}

.provider-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--adv-space-sm) var(--adv-space-xs);
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: transparent;
  cursor: pointer;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.provider-chip:hover {
  border-color: rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.04);
}

.provider-chip:active {
  transform: scale(0.97);
}

.provider-chip--active {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
}

.provider-chip__name {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.provider-chip__badge {
  font-size: 10px;
  font-weight: 500;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 1px 6px;
  border-radius: 10px;
}

/* ── Registration Link ── */
.registration-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--adv-font-body-sm);
  color: var(--ion-color-primary);
  text-decoration: none;
  font-weight: 500;
}

.registration-link:hover {
  text-decoration: underline;
}

.registration-link__icon {
  font-size: 13px;
}

/* ── Form Inputs ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.input-field__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input-field__label-icon {
  font-size: 13px;
}

.input-field__value {
  margin-left: auto;
  font-size: var(--adv-font-body-sm);
  color: var(--ion-color-primary);
  text-transform: none;
  letter-spacing: normal;
}

.input-field__input {
  width: 100%;
  height: 44px;
  padding: 0 var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  outline: none;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  box-sizing: border-box;
}

.input-field__input::placeholder {
  color: var(--adv-text-tertiary);
  font-family: inherit;
}

.input-field__input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.input-field__textarea {
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm);
  font-family: inherit;
  outline: none;
  resize: vertical;
  line-height: 1.5;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  box-sizing: border-box;
}

.input-field__textarea:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.input-field__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

/* ── Range Input ── */
.range-input {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--adv-border-subtle);
  outline: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.3);
}

/* ── Model Chips ── */
.model-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-xs);
}

.model-chip {
  padding: 6px 12px;
  border-radius: var(--adv-radius-sm);
  border: 1.5px solid var(--adv-border-subtle);
  background: transparent;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption);
  font-weight: 500;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  cursor: pointer;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.model-chip:hover {
  border-color: var(--ion-color-primary-tint);
}

.model-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(99, 102, 241, 0.08);
  color: var(--ion-color-primary);
  font-weight: 600;
}

/* ── Test Connection Button ── */
.test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-sm);
  width: 100%;
  height: 44px;
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--ion-color-primary);
  background: transparent;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.test-btn:not(:disabled):hover {
  background: rgba(99, 102, 241, 0.06);
}

.test-btn:not(:disabled):active {
  transform: scale(0.98);
}

.test-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.test-btn--success {
  border-color: var(--ion-color-success);
  color: var(--ion-color-success);
  background: rgba(16, 185, 129, 0.06);
}

.test-btn--failed {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
  background: rgba(239, 68, 68, 0.06);
}

.test-btn--loading {
  border-color: var(--adv-text-tertiary);
  color: var(--adv-text-tertiary);
}

.test-btn__spinner {
  width: 18px;
  height: 18px;
}

.test-error {
  margin: 0;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-sm);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  color: var(--ion-color-danger);
  font-size: var(--adv-font-caption);
  line-height: 1.4;
  word-break: break-word;
}

/* ── Collapsible Toggle ── */
.guide-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border: 1px dashed var(--adv-border-subtle);
  background: transparent;
  cursor: pointer;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.guide-toggle:hover {
  background: var(--adv-gradient-surface);
}

.guide-toggle__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
}

/* ── Transition ── */
.guide-enter-active,
.guide-leave-active {
  transition:
    max-height var(--adv-duration-normal) var(--adv-ease-default),
    opacity var(--adv-duration-normal) var(--adv-ease-default);
}

.guide-enter-from,
.guide-leave-to {
  max-height: 0;
  opacity: 0;
}

.guide-enter-to,
.guide-leave-from {
  max-height: 800px;
  opacity: 1;
}

/* ── Image hint ── */
.image-hint {
  margin: 0;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.4;
}
</style>
