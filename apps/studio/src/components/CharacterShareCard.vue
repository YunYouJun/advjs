<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { LANGUAGE_LABELS } from '@advjs/types'
import { computed } from 'vue'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'

const props = defineProps<{
  character: AdvCharacter
}>()

const avatarUrl = computed(() => getValidAvatarUrl(props.character.avatar))
const initials = computed(() => getCharacterInitials(props.character.name || props.character.id))
</script>

<template>
  <div class="share-card">
    <!-- Header -->
    <div class="share-card__header">
      <div class="share-card__avatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="share-card__avatar-img">
        <span v-else class="share-card__avatar-initials">{{ initials }}</span>
      </div>
      <div class="share-card__identity">
        <h2 class="share-card__name">
          {{ character.name }}
        </h2>
        <span v-if="character.faction" class="share-card__faction">{{ character.faction }}</span>
        <span v-if="character.language" class="share-card__lang">
          {{ LANGUAGE_LABELS[character.language] ?? character.language }}
        </span>
      </div>
    </div>

    <!-- Tags -->
    <div v-if="character.tags?.length" class="share-card__tags">
      <span v-for="tag in character.tags.slice(0, 5)" :key="tag" class="share-card__tag">{{ tag }}</span>
    </div>

    <!-- Body sections -->
    <div class="share-card__body">
      <div v-if="character.personality" class="share-card__section">
        <h3 class="share-card__section-title">
          性格 / Personality
        </h3>
        <p class="share-card__section-text">
          {{ character.personality.slice(0, 200) }}{{ character.personality.length > 200 ? '…' : '' }}
        </p>
      </div>
      <div v-if="character.appearance" class="share-card__section">
        <h3 class="share-card__section-title">
          外貌 / Appearance
        </h3>
        <p class="share-card__section-text">
          {{ character.appearance.slice(0, 150) }}{{ character.appearance.length > 150 ? '…' : '' }}
        </p>
      </div>
      <div v-if="character.concept" class="share-card__section">
        <h3 class="share-card__section-title">
          理念 / Concept
        </h3>
        <p class="share-card__section-text">
          {{ character.concept.slice(0, 100) }}{{ character.concept.length > 100 ? '…' : '' }}
        </p>
      </div>
    </div>

    <!-- Relationships -->
    <div v-if="character.relationships?.length" class="share-card__relations">
      <h3 class="share-card__section-title">
        关系 / Relationships
      </h3>
      <div class="share-card__rel-list">
        <span v-for="rel in character.relationships.slice(0, 3)" :key="rel.targetId" class="share-card__rel">
          {{ rel.targetId }} · {{ rel.type }}
        </span>
      </div>
    </div>

    <!-- Watermark -->
    <div class="share-card__watermark">
      ADV.JS Studio
    </div>
  </div>
</template>

<style scoped>
.share-card {
  width: 540px;
  min-height: 675px;
  padding: 40px 36px;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.share-card::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
  border-radius: 50%;
}

.share-card__header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.share-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 3px solid rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.15));
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.share-card__avatar-initials {
  font-size: 28px;
  font-weight: 800;
  color: #a78bfa;
  text-transform: uppercase;
}

.share-card__identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-card__name {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #e2e8f0, #a78bfa);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.2;
}

.share-card__faction {
  font-size: 13px;
  color: #94a3b8;
}

.share-card__lang {
  font-size: 11px;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.share-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.share-card__tag {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 99px;
  background: rgba(139, 92, 246, 0.12);
  color: #c4b5fd;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.share-card__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.share-card__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.share-card__section-title {
  font-size: 11px;
  font-weight: 700;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.share-card__section-text {
  font-size: 14px;
  line-height: 1.6;
  color: #cbd5e1;
  margin: 0;
}

.share-card__relations {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-card__rel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.share-card__rel {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.share-card__watermark {
  text-align: right;
  font-size: 12px;
  color: rgba(139, 92, 246, 0.4);
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-top: auto;
}
</style>
