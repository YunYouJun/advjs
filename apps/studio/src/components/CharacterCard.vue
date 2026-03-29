<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { IonChip, IonIcon } from '@ionic/vue'
import { imageOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = defineProps<{
  character: AdvCharacter
}>()

defineEmits<{
  click: [character: AdvCharacter]
}>()

const avatarUrl = computed(() => {
  const avatar = props.character.avatar
  if (!avatar)
    return ''
  if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('blob:'))
    return avatar
  return ''
})

const initials = computed(() => {
  const name = props.character.name || props.character.id || '?'
  return name.slice(0, 2)
})

const tachieCount = computed(() => {
  return props.character.tachies ? Object.keys(props.character.tachies).length : 0
})
</script>

<template>
  <button class="cc" type="button" @click="$emit('click', character)">
    <!-- Avatar -->
    <div class="cc-avatar">
      <img v-if="avatarUrl" :src="avatarUrl" alt="" class="cc-avatar__img" loading="lazy">
      <span v-else class="cc-avatar__initials">{{ initials }}</span>
    </div>

    <!-- Info -->
    <div class="cc-body">
      <div class="cc-name">
        {{ character.name }}
      </div>

      <p v-if="character.appearance" class="cc-desc">
        {{ character.appearance.slice(0, 60) }}{{ character.appearance.length > 60 ? '…' : '' }}
      </p>

      <div class="cc-footer">
        <div v-if="character.tags?.length" class="cc-tags">
          <IonChip v-for="tag in character.tags.slice(0, 3)" :key="tag" class="cc-tag">
            {{ tag }}
          </IonChip>
        </div>

        <div v-if="tachieCount > 0" class="cc-sprites">
          <IonIcon :icon="imageOutline" />
          <span>{{ tachieCount }}</span>
        </div>
      </div>

      <span v-if="character.faction" class="cc-faction">{{ character.faction }}</span>
    </div>
  </button>
</template>

<style scoped>
.cc {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: var(--adv-radius-lg, 12px);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition:
    box-shadow 0.2s ease,
    transform 0.15s ease,
    border-color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
}

.cc:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 2px 12px rgba(139, 92, 246, 0.08);
}

.cc:active {
  transform: scale(0.98);
}

.cc:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

/* Avatar */
.cc-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
}

.cc-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cc-avatar__initials {
  font-size: 18px;
  font-weight: 800;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}

/* Body */
.cc-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cc-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--adv-text-primary);
  line-height: 1.3;
}

.cc-desc {
  font-size: 13px;
  color: var(--adv-text-secondary);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.cc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.cc-tag {
  font-size: 11px;
  height: 22px;
  --padding-start: 8px;
  --padding-end: 8px;
  --background: rgba(139, 92, 246, 0.08);
  --color: #8b5cf6;
  margin: 0;
}

.cc-sprites {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.cc-sprites ion-icon {
  font-size: 14px;
}

.cc-faction {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .cc {
    transition: none;
  }
}
</style>
