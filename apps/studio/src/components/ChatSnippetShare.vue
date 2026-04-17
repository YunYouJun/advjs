<script setup lang="ts">
import type { ConversationTheme } from '../utils/conversationHtml'
import { computed } from 'vue'

export interface SnippetMessage {
  role: 'user' | 'assistant'
  content: string
  characterName?: string
  characterAvatar?: string
  timestamp?: number
}

const props = withDefaults(defineProps<{
  messages: SnippetMessage[]
  projectName?: string
  characterName?: string
  theme?: ConversationTheme
  /** Max messages to render (truncates with "… and N more") */
  maxMessages?: number
}>(), {
  projectName: undefined,
  characterName: undefined,
  theme: 'dark',
  maxMessages: 10,
})

const themeTokens = computed(() => {
  switch (props.theme) {
    case 'light':
      return {
        bgFrom: '#f8fafc',
        bgTo: '#e2e8f0',
        text: '#1a1a2e',
        textSecondary: '#475569',
        textMuted: '#64748b',
        userBg: 'rgba(139, 92, 246, 0.08)',
        userBorder: 'rgba(139, 92, 246, 0.25)',
        userRole: '#7c3aed',
        aiBg: 'rgba(99, 102, 241, 0.08)',
        aiBorder: 'rgba(99, 102, 241, 0.25)',
        aiRole: '#4f46e5',
        titleGradFrom: '#1a1a2e',
        titleGradTo: '#8b5cf6',
        watermark: 'rgba(99, 102, 241, 0.55)',
        glowColor: 'rgba(139, 92, 246, 0.12)',
      }
    case 'sepia':
      return {
        bgFrom: '#fdf6e3',
        bgTo: '#f5e6c8',
        text: '#3b2e1a',
        textSecondary: '#5a4628',
        textMuted: '#92742a',
        userBg: 'rgba(180, 83, 9, 0.1)',
        userBorder: 'rgba(180, 83, 9, 0.25)',
        userRole: '#b45309',
        aiBg: 'rgba(146, 116, 42, 0.1)',
        aiBorder: 'rgba(146, 116, 42, 0.25)',
        aiRole: '#92742a',
        titleGradFrom: '#3b2e1a',
        titleGradTo: '#b45309',
        watermark: 'rgba(180, 83, 9, 0.5)',
        glowColor: 'rgba(180, 83, 9, 0.12)',
      }
    case 'dark':
    default:
      return {
        bgFrom: '#0f172a',
        bgTo: '#1e293b',
        text: '#e2e8f0',
        textSecondary: '#cbd5e1',
        textMuted: '#64748b',
        userBg: 'rgba(16, 185, 129, 0.06)',
        userBorder: 'rgba(16, 185, 129, 0.12)',
        userRole: '#34d399',
        aiBg: 'rgba(99, 102, 241, 0.08)',
        aiBorder: 'rgba(99, 102, 241, 0.15)',
        aiRole: '#818cf8',
        titleGradFrom: '#e2e8f0',
        titleGradTo: '#60a5fa',
        watermark: 'rgba(99, 102, 241, 0.4)',
        glowColor: 'rgba(59, 130, 246, 0.12)',
      }
  }
})

const displayMessages = computed(() => props.messages.slice(0, props.maxMessages))
const overflowCount = computed(() => Math.max(0, props.messages.length - props.maxMessages))
const title = computed(() => props.characterName || props.projectName || 'ADV.JS')

const cardStyle = computed(() => ({
  background: `linear-gradient(165deg, ${themeTokens.value.bgFrom} 0%, ${themeTokens.value.bgTo} 100%)`,
  color: themeTokens.value.text,
}))

const titleStyle = computed(() => ({
  background: `linear-gradient(135deg, ${themeTokens.value.titleGradFrom}, ${themeTokens.value.titleGradTo})`,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}))

const glowStyle = computed(() => ({
  background: `radial-gradient(circle, ${themeTokens.value.glowColor} 0%, transparent 70%)`,
}))
</script>

<template>
  <div class="snippet-card" :style="cardStyle">
    <div class="snippet-card__glow" :style="glowStyle" />

    <!-- Header -->
    <div class="snippet-card__header">
      <h2 class="snippet-card__title" :style="titleStyle">
        {{ title }}
      </h2>
      <span class="snippet-card__count" :style="{ color: themeTokens.textMuted }">
        {{ messages.length }} messages
      </span>
    </div>

    <!-- Messages -->
    <div class="snippet-card__messages">
      <div
        v-for="(msg, i) in displayMessages"
        :key="i"
        class="snippet-msg"
        :style="{
          background: msg.role === 'user' ? themeTokens.userBg : themeTokens.aiBg,
          border: `1px solid ${msg.role === 'user' ? themeTokens.userBorder : themeTokens.aiBorder}`,
          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          maxWidth: msg.role === 'user' ? '85%' : '100%',
        }"
      >
        <span
          class="snippet-msg__role"
          :style="{ color: msg.role === 'user' ? themeTokens.userRole : themeTokens.aiRole }"
        >
          {{ msg.role === 'assistant' ? (msg.characterName || 'AI') : 'You' }}
        </span>
        <p class="snippet-msg__text" :style="{ color: themeTokens.textSecondary }">
          {{ msg.content.slice(0, 240) }}{{ msg.content.length > 240 ? '…' : '' }}
        </p>
      </div>

      <div v-if="overflowCount > 0" class="snippet-card__more" :style="{ color: themeTokens.textMuted }">
        … {{ overflowCount }} more
      </div>
    </div>

    <!-- Watermark -->
    <div class="snippet-card__footer">
      <span v-if="projectName" class="snippet-card__project" :style="{ color: themeTokens.textMuted }">
        {{ projectName }}
      </span>
      <span class="snippet-card__watermark" :style="{ color: themeTokens.watermark }">
        ADV.JS Studio
      </span>
    </div>
  </div>
</template>

<style scoped>
.snippet-card {
  width: 540px;
  min-height: 400px;
  padding: 32px 28px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  border-radius: 16px;
}

.snippet-card__glow {
  content: '';
  position: absolute;
  bottom: -40px;
  left: -40px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  pointer-events: none;
}

.snippet-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  position: relative;
}

.snippet-card__title {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}

.snippet-card__count {
  font-size: 12px;
  flex-shrink: 0;
}

.snippet-card__messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  position: relative;
}

.snippet-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 12px;
}

.snippet-msg__role {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.snippet-msg__text {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.snippet-card__more {
  text-align: center;
  font-size: 12px;
  padding: 8px 0;
  font-style: italic;
}

.snippet-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  position: relative;
}

.snippet-card__project {
  font-size: 12px;
  font-weight: 500;
}

.snippet-card__watermark {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}
</style>
