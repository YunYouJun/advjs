<script setup lang="ts">
import AGUIAccordion from '@advjs/gui/components/accordion/AGUIAccordion.vue'
import AGUIAccordionItem from '@advjs/gui/components/accordion/AGUIAccordionItem.vue'
import { ref } from 'vue'
import { useProjectContextPanel } from '../../../composables/useProjectContextPanel'
import ContextDocument from '../context/ContextDocument.vue'

const { t, sections, hasProject, hasContext, projectName, stats } = useProjectContextPanel()
const expanded = ref(['world', 'outline'])
</script>

<template>
  <section class="project-context-view" :aria-label="t('context.title')">
    <header class="context-header">
      <div class="context-toolbar">
        <span class="context-project" :title="projectName">{{ projectName || t('context.title') }}</span>
      </div>
      <p v-if="hasProject" class="context-description">
        {{ t('context.savedContext') }}
      </p>
      <dl v-if="hasContext" class="context-stats">
        <div v-for="stat in stats" :key="stat.label" class="context-stat">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.count }}</dd>
        </div>
      </dl>
    </header>

    <AGUIAccordion v-if="hasContext" v-model="expanded" type="multiple">
      <AGUIAccordionItem v-for="section in sections" :key="section.value" :item="section">
        <ContextDocument :content="section.content" />
      </AGUIAccordionItem>
    </AGUIAccordion>
    <div v-else class="context-empty">
      <span class="i-ri-file-text-line context-empty-icon" aria-hidden="true" />
      <p>{{ t(hasProject ? 'context.empty' : 'context.openProject') }}</p>
      <p class="context-empty-hint">
        {{ t('context.emptyHint') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.project-context-view {
  min-width: 0;
  color: var(--agui-c-text-1);
  font-size: 13px;
  line-height: 1.5;
}
.context-header {
  padding: 8px 12px 4px;
}
.context-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.context-project {
  flex: 1 1 120px;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.context-description {
  margin: 4px 0 8px;
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.context-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  font-size: 12px;
}
.context-stat {
  display: flex;
  gap: 8px;
}
.context-stat dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.context-empty {
  padding: 24px 12px;
}
.context-empty-icon {
  display: block;
  font-size: 16px;
}
.context-empty p {
  margin: 8px 0 0;
}
.context-empty-hint {
  color: var(--agui-c-text-2);
  font-size: 12px;
}
</style>
