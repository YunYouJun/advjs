<script setup lang="ts">
import { computed } from 'vue'

export interface SnippetMessage {
  role: 'user' | 'assistant'
  content: string
  characterName?: string
  characterAvatar?: string
  timestamp?: number
}

const props = defineProps<{
  messages: SnippetMessage[]
  projectName?: string
  characterName?: string
}>()

const displayMessages = computed(() => props.messages.slice(0, 10))
const title = computed(() => props.characterName || props.projectName || 'ADV.JS')
</script>

<template>
  <div class="snippet-card">
    <!-- Header -->
    <div class="snippet-card__header">
      <h2 class="snippet-card__title">
        {{ title }}
      </h2>
      <span class="snippet-card__count">{{ messages.length }} messages</span>
    </div>

    <!-- Messages -->
    <div class="snippet-card__messages">
      <div
        v-for="(msg, i) in displayMessages"
        :key="i"
        class="snippet-msg"
        :class="[`snippet-msg--${msg.role}`]"
      >
        <span class="snippet-msg__role">
          {{ msg.role === 'assistant' ? (msg.characterName || 'AI') : 'You' }}
        </span>
        <p class="snippet-msg__text">
          {{ msg.content.slice(0, 200) }}{{ msg.content.length > 200 ? '…' : '' }}
        </p>
      </div>
    </div>

    <!-- Watermark -->
    <div class="snippet-card__footer">
      <span v-if="projectName" class="snippet-card__project">{{ projectName }}</span>
      <span class="snippet-card__watermark">ADV.JS Studio</span>
    </div>
  </div>
</template>

<style scoped>
.snippet-card {
  width: 540px;
  min-height: 400px;
  padding: 32px 28px;
  background: linear-gradient(165deg, #0f172a 0%, #1e293b 100%);
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.snippet-card::before {
  content: '';
  position: absolute;
  bottom: -40px;
  left: -40px;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
  border-radius: 50%;
}

.snippet-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.snippet-card__title {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #e2e8f0, #60a5fa);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.snippet-card__count {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.snippet-card__messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.snippet-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.snippet-msg--assistant {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.15);
}

.snippet-msg--user {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.12);
  align-self: flex-end;
  max-width: 85%;
}

.snippet-msg__role {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.snippet-msg--assistant .snippet-msg__role {
  color: #818cf8;
}

.snippet-msg--user .snippet-msg__role {
  color: #34d399;
}

.snippet-msg__text {
  font-size: 13px;
  line-height: 1.6;
  color: #cbd5e1;
  margin: 0;
}

.snippet-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.snippet-card__project {
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.snippet-card__watermark {
  font-size: 12px;
  color: rgba(99, 102, 241, 0.4);
  font-weight: 700;
  letter-spacing: 0.1em;
}
</style>
