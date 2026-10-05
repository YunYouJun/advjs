<script setup lang="ts">
import type { ChapterProgress } from '../../../composables/useAuthoringOverview'
import { computed } from 'vue'

const props = defineProps<{ chapters: ChapterProgress[], zh: boolean }>()
const completed = computed(() => props.chapters.filter(chapter => chapter.status === 'completed').length)
const percent = computed(() => props.chapters.length ? Math.round(completed.value / props.chapters.length * 100) : 0)
const statusLabel = computed(() => props.zh ? { completed: '已完成', draft: '草稿', pending: '待创作' } : { completed: 'Complete', draft: 'Draft', pending: 'Pending' })
</script>

<template>
  <section class="dashboard-section">
    <h3>{{ zh ? '章节进度' : 'Chapter progress' }} <span>{{ completed }} / {{ chapters.length }}</span></h3>
    <progress :value="percent" max="100" :aria-label="zh ? '章节完成进度' : 'Chapter completion'" />
    <ul v-if="chapters.length">
      <li v-for="(chapter, index) in chapters" :key="index">
        <span>{{ chapter.name }}</span><span class="chapter-status" :data-status="chapter.status">{{ statusLabel[chapter.status] }}</span>
      </li>
    </ul>
    <p v-else>
      {{ zh ? '在 chapters/README.md 中记录章节进度。' : 'Track chapter progress in chapters/README.md.' }}
    </p>
  </section>
</template>

<style scoped>
h3 span {
  margin-left: 8px;
  color: var(--agui-c-text-2);
  font-weight: 400;
}
progress {
  display: block;
  width: 100%;
  height: 4px;
  margin: 8px 0;
  border: 0;
  background: var(--agui-c-field);
  accent-color: var(--agui-c-primary);
}
progress::-webkit-progress-bar {
  background: var(--agui-c-field);
}
progress::-webkit-progress-value {
  background: var(--agui-c-primary);
}
progress::-moz-progress-bar {
  background: var(--agui-c-primary);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--agui-c-divider-light);
}
li > span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.chapter-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--agui-c-text-2);
}
.chapter-status[data-status='completed'] {
  color: var(--agui-c-success-text);
}
.chapter-status[data-status='draft'] {
  color: var(--agui-c-warning-text);
}
</style>
