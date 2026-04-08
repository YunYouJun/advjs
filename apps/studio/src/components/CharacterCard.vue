<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { IonIcon } from '@ionic/vue'
import { imageOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { getCharacterInitials, getDomainIcon, getMoodEmoji, getValidAvatarUrl } from '../utils/chatUtils'

const props = defineProps<{
  character: AdvCharacter
  mood?: string
  location?: string
}>()

defineEmits<{
  click: [character: AdvCharacter]
}>()

const avatarUrl = computed(() => getValidAvatarUrl(props.character.avatar))

const initials = computed(() => getCharacterInitials(props.character.name || props.character.id))

const tachieCount = computed(() => {
  return props.character.tachies ? Object.keys(props.character.tachies).length : 0
})

const moodEmoji = computed(() => {
  if (!props.mood)
    return ''
  return getMoodEmoji(props.mood)
})

const domainIcon = computed(() => getDomainIcon(props.character.knowledgeDomain || ''))
</script>

<template>
  <div class="cc-wrapper">
    <button class="cc" type="button" @click="$emit('click', character)">
      <!-- Avatar -->
      <div class="cc-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="cc-avatar__img" loading="lazy">
        <span v-else class="cc-avatar__initials">{{ initials }}</span>
        <span v-if="moodEmoji" class="cc-mood-badge">{{ moodEmoji }}</span>
      </div>

      <!-- Info -->
      <div class="cc-body">
        <div class="cc-name">
          {{ character.name }}
        </div>

        <span v-if="character.faction" class="cc-faction">{{ character.faction }}</span>

        <span v-if="character.knowledgeDomain" class="cc-domain">
          {{ domainIcon }} {{ character.knowledgeDomain }}
        </span>

        <p v-if="character.appearance" class="cc-desc">
          {{ character.appearance.slice(0, 55) }}{{ character.appearance.length > 55 ? '…' : '' }}
        </p>

        <div v-if="location" class="cc-location">
          📍 {{ location }}
        </div>

        <div class="cc-footer">
          <div v-if="character.tags?.length" class="cc-tags">
            <span v-for="tag in character.tags.slice(0, 2)" :key="tag" class="cc-tag">
              {{ tag }}
            </span>
          </div>

          <div v-if="tachieCount > 0" class="cc-sprites">
            <IonIcon :icon="imageOutline" />
            <span>{{ tachieCount }}</span>
          </div>
        </div>
      </div>
    </button>

    <!-- Overlay actions slot -->
    <div v-if="$slots.actions" class="cc-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* ── Wrapper (groups card + actions) ── */
.cc-wrapper {
  width: 100%;
  min-width: 0;
  border-radius: var(--adv-radius-lg, 14px);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  overflow: hidden;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.cc-wrapper:hover {
  border-color: rgba(139, 92, 246, 0.35);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.1);
}

/* ── Card shell ── */
.cc {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  transition: transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.cc:active {
  transform: scale(0.97);
}

.cc:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: -2px;
}

/* ── Avatar ── */
.cc-avatar {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: visible;
  flex-shrink: 0;
}

.cc-avatar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(99, 102, 241, 0.1));
}

.cc-avatar__img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.cc-avatar__initials {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(99, 102, 241, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}

.cc-mood-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 13px;
  line-height: 1;
  background: var(--adv-surface-card, #fff);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

/* ── Body ── */
.cc-body {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.cc-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--adv-text-primary);
  line-height: 1.3;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-faction {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  line-height: 1.3;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-domain {
  display: inline-block;
  max-width: 100%;
  font-size: 10px;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 2px 7px;
  border-radius: var(--adv-radius-sm, 6px);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-desc {
  font-size: 11px;
  color: var(--adv-text-secondary);
  line-height: 1.4;
  margin: 2px 0 0;
  width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cc-location {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

/* ── Footer (tags + sprite count) ── */
.cc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 4px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.cc-tags {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow: hidden;
  min-width: 0;
}

.cc-tag {
  font-size: 10px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(139, 92, 246, 0.08);
  color: #8b5cf6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 72px;
  flex-shrink: 0;
}

.cc-sprites {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.cc-sprites ion-icon {
  font-size: 13px;
}

/* ── Actions slot (full-width row below card body) ── */
.cc-actions {
  width: 100%;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .cc {
    transition: none;
  }
}
</style>
