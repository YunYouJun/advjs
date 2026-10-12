<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { computed } from 'vue'
import { useAudioWorkspaceNavigation } from '../../composables/useAudioWorkspaceNavigation'

const props = defineProps<{ character: AdvCharacter }>()
const { t } = useI18n()
const navigation = useAudioWorkspaceNavigation()
const bindings = computed(() => Object.entries(props.character.voiceProfile?.locales ?? {}).flatMap(([locale, binding]) => Object.entries(binding.providers).map(([providerId, implementation]) => ({ locale, providerId, ...implementation }))))
</script>

<template>
  <section class="character-voice-workflow" :aria-label="t('characters.voice.workflowTitle')">
    <strong>{{ t('characters.voice.workflowTitle') }}</strong>
    <p v-if="!bindings.length" class="ae-resource-caption" role="status">
      {{ t('characters.voice.notApplied') }}
    </p>
    <div v-for="binding in bindings" :key="`${binding.locale}/${binding.providerId}`" class="ae-resource-caption" data-testid="character-applied-voice">
      {{ t('characters.voice.applied') }} · {{ binding.locale }} · {{ binding.providerId }} · {{ binding.voiceId }}
      <span v-if="binding.projectVoiceId"> · {{ binding.projectVoiceId }} / {{ binding.projectVoiceVersion }}</span>
    </div>
    <div class="character-voice-workflow-actions">
      <AGUIButton :disabled="!navigation.available.value" data-testid="character-voice-design" @click="navigation.open('design', character.id)">
        {{ t('characters.voice.designApply') }}
      </AGUIButton>
      <AGUIButton :disabled="!navigation.available.value" data-testid="character-voice-jobs" @click="navigation.open('jobs', character.id)">
        {{ t('characters.voice.generateDialogue') }}
      </AGUIButton>
      <AGUIButton :disabled="!navigation.available.value" data-testid="character-voice-takes" @click="navigation.open('voice', character.id)">
        {{ t('characters.voice.reviewDialogue') }}
      </AGUIButton>
    </div>
    <p class="ae-resource-caption">
      {{ t('characters.voice.workflowHint') }}
    </p>
  </section>
</template>

<style scoped>
.character-voice-workflow {
  display: grid;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid var(--agui-c-divider);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.character-voice-workflow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.character-voice-workflow strong {
  font-weight: 500;
}
.character-voice-workflow p {
  margin: 0;
}
</style>
