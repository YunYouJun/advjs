<!--
  Chat conversation snippet share card.
  Prebuilt for future "share chat snippet as image" feature.
  Designed for use with modern-screenshot / domToPng.
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  messages: Array<{ role: string, content: string, timestamp: number }>
  characterName?: string
  projectName?: string
}>(), {
  characterName: 'Character',
  projectName: 'ADV.JS',
})

const displayMessages = computed(() => props.messages.slice(0, 10))

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string, max = 200): string {
  if (text.length <= max)
    return text
  return `${text.slice(0, max)}…`
}
</script>

<template>
  <div class="snapshot-card">
    <!-- Header -->
    <div class="snapshot-card__header">
      <div class="snapshot-card__avatar">
        {{ characterName.charAt(0).toUpperCase() }}
      </div>
      <div class="snapshot-card__title">
        <h2 class="snapshot-card__name">
          {{ characterName }}
        </h2>
        <span class="snapshot-card__project">{{ projectName }}</span>
      </div>
    </div>

    <!-- Messages -->
    <div class="snapshot-card__messages">
      <div
        v-for="msg in displayMessages"
        :key="msg.timestamp"
        class="snapshot-card__msg"
        :class="[`snapshot-card__msg--${msg.role}`]"
      >
        <div class="snapshot-card__bubble">
          <p class="snapshot-card__text">
            {{ truncate(msg.content) }}
          </p>
          <span class="snapshot-card__time">{{ formatTime(msg.timestamp) }}</span>
        </div>
      </div>
    </div>

    <!-- Watermark -->
    <div class="snapshot-card__footer">
      <span class="snapshot-card__watermark">ADV.JS Studio</span>
      <span class="snapshot-card__count">{{ messages.length }} messages</span>
    </div>
  </div>
</template>

<style scoped>
.snapshot-card {
  width: 480px;
  min-height: 600px;
  padding: 32px 28px;
  background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%);
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.snapshot-card::before {
  content: '';
  position: absolute;
  top: -80px;
  right: -80px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
  border-radius: 50%;
}

.snapshot-card__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.snapshot-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.snapshot-card__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.snapshot-card__name {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: #f1f5f9;
}

.snapshot-card__project {
  font-size: 13px;
  color: #94a3b8;
}

.snapshot-card__messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.snapshot-card__msg {
  display: flex;
}

.snapshot-card__msg--user {
  justify-content: flex-end;
}

.snapshot-card__msg--assistant {
  justify-content: flex-start;
}

.snapshot-card__bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px;
  position: relative;
}

.snapshot-card__msg--user .snapshot-card__bubble {
  background: rgba(99, 102, 241, 0.25);
  border-bottom-right-radius: 4px;
}

.snapshot-card__msg--assistant .snapshot-card__bubble {
  background: rgba(255, 255, 255, 0.08);
  border-bottom-left-radius: 4px;
}

.snapshot-card__text {
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
}

.snapshot-card__time {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
  display: block;
  text-align: right;
}

.snapshot-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.snapshot-card__watermark {
  font-size: 12px;
  font-weight: 700;
  color: rgba(139, 92, 246, 0.5);
  letter-spacing: 0.1em;
}

.snapshot-card__count {
  font-size: 11px;
  color: #64748b;
}
</style>
