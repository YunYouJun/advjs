<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { IonChip } from '@ionic/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'

const props = defineProps<{
  character: AdvCharacter
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const { t } = useI18n()

const avatarUrl = computed(() => getValidAvatarUrl(props.character.avatar))

const initials = computed(() => getCharacterInitials(props.character.name || props.character.id))

const personalitySummary = computed(() => {
  const p = props.character.personality
  if (!p)
    return ''
  return p.slice(0, 80) + (p.length > 80 ? '…' : '')
})

const suggestedTopics = computed(() => {
  const topics: string[] = []

  // Based on background
  if (props.character.background) {
    topics.push(t('world.topicBackground', { name: props.character.name }))
  }

  // Based on knowledge domain
  if (props.character.knowledgeDomain) {
    topics.push(t('world.topicExpertise', { domain: props.character.knowledgeDomain }))
  }

  // Default greeting
  topics.push(t('world.topicGreeting', { name: props.character.name }))

  return topics.slice(0, 3)
})
</script>

<template>
  <div class="ccw">
    <!-- Large avatar -->
    <div class="ccw-avatar">
      <img v-if="avatarUrl" :src="avatarUrl" alt="" class="ccw-avatar__img" loading="lazy">
      <span v-else class="ccw-avatar__initials">{{ initials }}</span>
    </div>

    <!-- Name + summary -->
    <h3 class="ccw-name">
      {{ character.name }}
    </h3>
    <p v-if="personalitySummary" class="ccw-personality">
      {{ personalitySummary }}
    </p>

    <!-- Suggested topics -->
    <div class="ccw-topics">
      <IonChip
        v-for="(topic, i) in suggestedTopics"
        :key="i"
        color="primary"
        @click="emit('send', topic)"
      >
        {{ topic }}
      </IonChip>
    </div>
  </div>
</template>

<style scoped>
.ccw {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
}

.ccw-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-md);
  box-shadow: var(--adv-shadow-medium);
}

.ccw-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ccw-avatar__initials {
  font-size: 32px;
  font-weight: 800;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}

.ccw-name {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
}

.ccw-personality {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0 0 var(--adv-space-lg);
  max-width: 280px;
  line-height: 1.5;
}

.ccw-topics {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--adv-space-sm);
}
</style>
