<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AiApiError, testAiConnection } from '../../../../../../packages/ai/src'
import { useAiMode } from '../../../composables/ai-mode'
import { aiCopy } from './copy'
import { checkSettings, clearSettings, CUSTOM_PROVIDER, defaultSettings, endpointOf, hostOf, loadSettings, presetOf, providers, saveSettings } from './settings'

const ai = useAiMode()!
const t = aiCopy[ai.locale].dialog
const errors = aiCopy[ai.locale].errors

const stored = loadSettings()
const form = ref({ ...(stored ?? defaultSettings()) })
const remember = ref(stored?.remember ?? false)
const testing = ref(false)
const failure = ref<string>()
const cleared = ref(false)
const dialog = ref<HTMLDialogElement>()

const preset = computed(() => presetOf(form.value.providerId))
const needsKey = computed(() => preset.value?.needsKey !== false)
const host = computed(() => hostOf(form.value.baseURL))

function pickProvider(id: string) {
  const next = presetOf(id)
  form.value = { ...form.value, providerId: id, baseURL: next?.baseURL ?? '', model: next?.models[0] ?? '' }
  failure.value = undefined
}

async function submit() {
  const problem = checkSettings(form.value)
  failure.value = problem && t.problems[problem]
  if (problem)
    return
  testing.value = true
  try {
    await testAiConnection(endpointOf(form.value))
    saveSettings(form.value, remember.value)
    await ai.begin()
  }
  catch (error) {
    failure.value = error instanceof AiApiError ? errors[error.type] : errors.internal
  }
  finally {
    testing.value = false
  }
}

function clear() {
  clearSettings()
  form.value = defaultSettings()
  remember.value = false
  cleared.value = true
}

function cancel() {
  ai.settingsOpen.value = false
  // Nothing to go back to: leave AI mode instead of an empty stage.
  if (!ai.run.value?.story.value)
    ai.leave()
}

onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="ai-settings" aria-labelledby="ai-settings-title" @cancel.prevent="cancel">
    <form @submit.prevent="submit">
      <h2 id="ai-settings-title" class="title">
        {{ t.title }}
      </h2>
      <p class="intro">
        {{ t.intro }}
      </p>

      <label class="field">
        <span class="label">{{ t.provider }}</span>
        <select :value="form.providerId" @change="pickProvider(($event.target as HTMLSelectElement).value)">
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          <option :value="CUSTOM_PROVIDER">{{ t.custom }}</option>
        </select>
      </label>

      <label v-if="form.providerId === CUSTOM_PROVIDER" class="field">
        <span class="label">{{ t.baseURL }}</span>
        <input v-model="form.baseURL" type="url" inputmode="url" placeholder="https://…/v1" autocomplete="off" spellcheck="false">
      </label>

      <label class="field">
        <span class="label">{{ t.model }}</span>
        <input v-model="form.model" list="ai-settings-models" autocomplete="off" spellcheck="false">
        <datalist id="ai-settings-models">
          <option v-for="model in preset?.models ?? []" :key="model" :value="model" />
        </datalist>
      </label>

      <label class="field">
        <span class="label">
          {{ t.apiKey }}
          <a v-if="preset?.registrationUrl" class="get-key" :href="preset.registrationUrl" target="_blank" rel="noopener noreferrer">{{ t.getKey }}</a>
        </span>
        <input v-model="form.apiKey" type="password" autocomplete="off" spellcheck="false" :placeholder="needsKey ? 'sk-…' : t.noKey">
      </label>

      <label class="check">
        <input v-model="remember" type="checkbox">
        <span>{{ t.remember }}</span>
      </label>

      <p class="privacy">
        {{ t.privacy(host) }}
      </p>
      <p v-if="failure" class="failure" role="alert">
        {{ failure }}
      </p>

      <div class="actions">
        <button type="button" class="quiet" @click="clear">
          {{ cleared ? t.cleared : t.clear }}
        </button>
        <span class="spacer" />
        <button v-if="ai.run.value?.hasSample" type="button" class="secondary" @click="ai.sample()">
          {{ t.sample }}
        </button>
        <button type="button" class="secondary" @click="cancel">
          {{ t.cancel }}
        </button>
        <button type="submit" class="primary" :disabled="testing">
          {{ testing ? t.testing : t.start }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.ai-settings {
  box-sizing: border-box;
  /* The page's reset drops the UA's centering of modal dialogs. */
  margin: auto;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: 0 24px 64px -24px rgba(0, 0, 0, 0.5);
}

.ai-settings::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

form {
  display: grid;
  gap: 14px;
  padding: 22px 20px 18px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.intro,
.privacy {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.privacy {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.field {
  display: grid;
  gap: 6px;
}

.label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.get-key {
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.field :is(input, select) {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  color: inherit;
  background: var(--vp-c-bg-soft);
}

.field :is(input, select):focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

.check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.check input {
  margin-top: 3px;
}

.failure {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-danger-1);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.spacer {
  flex: 1;
}

.actions button {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.actions .quiet {
  padding: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.actions .secondary {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.actions .primary {
  color: var(--vp-c-white);
  background: var(--vp-c-brand-3);
}

.actions .primary:disabled {
  cursor: progress;
  opacity: 0.7;
}

.actions button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
