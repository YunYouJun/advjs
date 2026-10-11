<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocalVoiceConnection } from '../../composables/useLocalVoiceConnection'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'

const { t } = useI18n()
const { baseUrl, accessToken, error, eligible, connected, projectId, canConnect, connecting, session, connect, disconnect } = useLocalVoiceConnection()
</script>

<template>
  <section v-if="eligible" class="audio-local" data-testid="local-voice-connection" :aria-busy="connecting">
    <div>
      <h2 class="audio-local__title">
        {{ t('audioLocal.title') }}
      </h2>
      <p class="audio-local__hint">
        {{ t('audioLocal.hint') }}
      </p>
    </div>
    <div class="audio-local__project">
      <span>{{ t('audioLocal.project') }}</span>
      <code data-testid="audio-local-project-id">{{ projectId }}</code>
      <p class="audio-local__hint">
        {{ t('audioLocal.projectHint') }}
      </p>
    </div>
    <p v-if="connected" class="audio-local__status" role="status">
      {{ t('audioLocal.connected', { url: session?.baseUrl }) }}
    </p>
    <form v-else class="audio-local__form" autocomplete="off" @submit.prevent="connect">
      <label class="audio-local__field">
        <span>{{ t('audioLocal.url') }}</span>
        <SInput v-model="baseUrl" size="lg" inputmode="url" :disabled="connecting" />
      </label>
      <label class="audio-local__field">
        <span>{{ t('audioLocal.token') }}</span>
        <SInput v-model="accessToken" type="password" size="lg" :maxlength="64" :disabled="connecting" />
      </label>
      <p class="audio-local__hint">
        {{ t('audioLocal.tokenHint') }}
      </p>
      <SButton type="submit" size="lg" :loading="connecting" :disabled="!canConnect">
        {{ t('audioLocal.connect') }}
      </SButton>
    </form>
    <p v-if="error" class="audio-local__error" role="alert">
      {{ t('audioLocal.failed') }}
    </p>
    <SButton v-if="connected || connecting" size="lg" variant="outline" @click="disconnect">
      {{ t(connecting ? 'audioLocal.cancel' : 'audioLocal.disconnect') }}
    </SButton>
  </section>
</template>

<style scoped>
.audio-local,
.audio-local__form,
.audio-local__field {
  display: grid;
  min-width: 0;
  gap: var(--adv-space-sm);
}
.audio-local {
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
}
.audio-local__title {
  margin: 0;
  font-size: var(--adv-font-subtitle);
}
.audio-local__field,
.audio-local__project {
  font-size: var(--adv-font-body);
  overflow-wrap: anywhere;
}
.audio-local__project code {
  display: block;
  margin-top: var(--adv-space-xs);
}
.audio-local__hint {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  margin: var(--adv-space-xs) 0;
}
.audio-local__status {
  color: var(--adv-color-success);
  overflow-wrap: anywhere;
}
.audio-local__error {
  color: var(--adv-color-danger);
}
</style>
