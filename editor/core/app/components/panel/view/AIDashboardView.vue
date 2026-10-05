<script setup lang="ts">
import { useAuthoringOverview } from '../../../composables/useAuthoringOverview'
import DashboardChapters from '../dashboard/DashboardChapters.vue'
import DashboardCharacters from '../dashboard/DashboardCharacters.vue'

const { project, zh, chapters, characters, stats, hasWorld } = useAuthoringOverview()
</script>

<template>
  <section class="authoring-overview" :aria-label="zh ? 'AI 工作台' : 'Authoring overview'">
    <template v-if="project">
      <header>
        <h2>{{ project.name || (zh ? '当前项目' : 'Current project') }}</h2>
        <p>{{ zh ? '已保存的创作进度与资料' : 'Saved writing progress and reference material' }}</p>
      </header>
      <dl class="overview-summary">
        <div><dt>{{ zh ? '章节' : 'Chapters' }}</dt><dd>{{ stats.chapters }}</dd></div>
        <div><dt>{{ zh ? '人物' : 'Characters' }}</dt><dd>{{ stats.characters }}</dd></div>
        <div><dt>{{ zh ? '场景' : 'Scenes' }}</dt><dd>{{ stats.scenes }}</dd></div>
        <div><dt>{{ zh ? '世界观' : 'World' }}</dt><dd>{{ hasWorld ? (zh ? '已添加' : 'Available') : (zh ? '未添加' : 'Not added') }}</dd></div>
      </dl>
      <DashboardChapters :chapters="chapters" :zh="zh" />
      <DashboardCharacters :characters="characters" :count="stats.characters" :zh="zh" />
    </template>
    <div v-else class="overview-empty">
      <h2>{{ zh ? '打开项目以查看创作进度' : 'Open a project to view writing progress' }}</h2>
      <p>{{ zh ? '章节进度、人物资料和场景统计会随当前项目更新。' : 'Chapter progress, characters and scene counts follow the current project.' }}</p>
    </div>
  </section>
</template>

<style scoped>
.authoring-overview {
  padding: 12px;
  max-width: 800px;
  margin: 0 auto;
  font-size: 13px;
  line-height: 1.6;
  color: var(--agui-c-text-1);
}
h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
p {
  margin: 4px 0 12px;
  color: var(--agui-c-text-2);
}
.overview-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0 0 16px;
  padding: 8px 0;
  border-block: 1px solid var(--agui-c-divider);
}
.overview-summary > div {
  display: flex;
  gap: 8px;
}
dt {
  color: var(--agui-c-text-2);
}
dd {
  margin: 0;
}
:deep(.dashboard-section) {
  margin-bottom: 16px;
}
:deep(.dashboard-section h3) {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}
:deep(.dashboard-section p) {
  margin: 4px 0;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.overview-empty {
  padding: 12px 0;
}
</style>
