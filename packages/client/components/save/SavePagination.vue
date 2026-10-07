<script setup lang="ts">
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{
  currentPage: number
  pages: number
  hasSystemPage?: boolean
}>(), {
  hasSystemPage: false,
})

const emit = defineEmits<{
  change: [page: number]
}>()

const { t } = useI18n()
</script>

<template>
  <nav class="save-pagination" :aria-label="t('save.page_navigation')">
    <div class="save-pagination__inner">
      <AdvTextButton
        v-if="hasSystemPage"
        :active="currentPage === 0"
        class="save-pagination__button save-pagination__button--system"
        :aria-current="currentPage === 0 ? 'page' : undefined"
        :title="t('save.system_page')"
        data-save-page="system"
        @click="emit('change', 0)"
      >
        <span i-ri-history-line aria-hidden="true" />
        <span>{{ t('save.system_page_short') }}</span>
      </AdvTextButton>

      <AdvTextButton
        v-for="page in pages"
        :key="page"
        :active="currentPage === page"
        class="save-pagination__button"
        :aria-current="currentPage === page ? 'page' : undefined"
        :aria-label="t('save.manual_page', { page })"
        :data-save-page="page"
        @click="emit('change', page)"
      >
        {{ page }}
      </AdvTextButton>
    </div>
  </nav>
</template>

<style scoped>
.save-pagination {
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 100%;
  overflow-x: auto;
  padding: calc(8px / var(--adv-screen-scale, 1));
  border-top: 1px solid var(--adv-save-border-color, color-mix(in srgb, var(--adv-c-text) 16%, transparent));
  scrollbar-width: thin;
}

.save-pagination__inner {
  display: flex;
  width: max-content;
  min-width: 100%;
  align-items: center;
  justify-content: center;
  gap: calc(4px / var(--adv-screen-scale, 1));
}

.save-pagination__button {
  display: inline-flex;
  min-width: calc(32px / var(--adv-screen-scale, 1));
  height: calc(32px / var(--adv-screen-scale, 1));
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 calc(8px / var(--adv-screen-scale, 1));
  border-radius: calc(var(--adv-save-control-radius, var(--adv-control-radius, 4px)) / var(--adv-screen-scale, 1));
  background: transparent;
  color: var(--adv-c-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: calc(14px / var(--adv-screen-scale, 1));
  line-height: 1;
  transition-duration: var(--adv-save-motion-duration, 180ms);
  white-space: nowrap;
}

.save-pagination__button--system {
  min-width: calc(64px / var(--adv-screen-scale, 1));
  gap: calc(4px / var(--adv-screen-scale, 1));
  font-family: inherit;
}

.save-pagination__button:hover,
.save-pagination__button.active {
  background: var(--adv-c-primary-light);
}

@container adv-game (max-width: 599px) {
  .save-pagination__inner {
    justify-content: flex-start;
  }
}
</style>
