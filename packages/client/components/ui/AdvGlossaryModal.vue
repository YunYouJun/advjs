<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import { DialogClose } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AdvGlossaryContent from './AdvGlossaryContent'
import AdvModal from './AdvModal.vue'

const app = useAppStore()
const { t } = useI18n()
const title = computed(() => app.glossaryTerm?.label?.slice(1, -1) || app.glossaryTerm?.identifier)
</script>

<template>
  <AdvModal v-model:open="app.showGlossary" :header="title" @click.stop>
    <template #header>
      <div class="adv-glossary-header">
        <h1 class="adv-glossary-title">
          {{ title }}
        </h1>
        <DialogClose as-child>
          <AdvIconButton :title="t('button.close')" class="adv-glossary-close">
            <span i-ri-close-line aria-hidden="true" />
          </AdvIconButton>
        </DialogClose>
      </div>
    </template>
    <AdvGlossaryContent
      class="adv-glossary-definition"
      :content="app.glossaryTerm?.definitionContent"
      :text="app.glossaryTerm?.definition"
    />
  </AdvModal>
</template>

<style scoped>
.adv-glossary-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(16px / var(--adv-screen-scale, 1));
  padding: calc(16px / var(--adv-screen-scale, 1));
  border-bottom: 1px solid color-mix(in srgb, var(--adv-c-text) 16%, transparent);
  text-align: left;
}

.adv-glossary-title {
  min-width: 0;
  margin: 0;
  font-family: var(--adv-font-family, inherit);
  font-size: calc(clamp(20px, 2.5cqw, 28px) / var(--adv-screen-scale, 1));
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  text-align: left;
}

.adv-glossary-close {
  flex: none;
  width: calc(36px / var(--adv-screen-scale, 1));
  height: calc(36px / var(--adv-screen-scale, 1));
  padding: 0;
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
  font-size: calc(22px / var(--adv-screen-scale, 1));
}

.adv-glossary-definition {
  box-sizing: border-box;
  width: 100%;
  max-width: 46em;
  min-width: 0;
  padding: 1.25em 1.5em 2em;
  overflow-wrap: anywhere;
  font-family: var(--adv-font-family, inherit);
  font-size: calc(20px / var(--adv-screen-scale, 1));
  line-height: 1.7;
  text-align: left;
}

.adv-glossary-definition :deep(p) {
  margin: 0 0 0.9em;
}

.adv-glossary-definition :deep(.adv-glossary-plain) {
  white-space: pre-wrap;
}

.adv-glossary-definition :deep(ul),
.adv-glossary-definition :deep(ol) {
  margin: 0.6em 0 1em;
  padding-inline-start: 1.6em;
}

.adv-glossary-definition :deep(ul) {
  list-style: disc;
}

.adv-glossary-definition :deep(ol) {
  list-style: decimal;
}

.adv-glossary-definition :deep(li) {
  margin-block: 0.35em;
  padding-inline-start: 0.15em;
}

.adv-glossary-definition :deep(li > p) {
  margin-bottom: 0.35em;
}

.adv-glossary-definition :deep(strong) {
  font-weight: 700;
}

.adv-glossary-definition :deep(em) {
  font-style: italic;
}

.adv-glossary-definition :deep(code) {
  padding: 0.1em 0.3em;
  border-radius: var(--adv-control-radius, 4px);
  background: color-mix(in srgb, var(--adv-c-text) 8%, transparent);
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  white-space: pre-wrap;
}

@container adv-game (max-width: 600px) {
  .adv-glossary-definition {
    padding: 1em 1em 1.5em;
    font-size: calc(18px / var(--adv-screen-scale, 1));
  }
}
</style>
