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
  padding: 0.75rem max(1rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
  border-top: 1px solid rgb(128 128 128 / 24%);
  scrollbar-width: thin;
}

.save-pagination__inner {
  display: flex;
  width: max-content;
  min-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.save-pagination__button {
  display: inline-flex;
  min-width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: var(--adv-save-control-radius, 0.25rem);
  background: transparent;
  color: var(--adv-c-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9rem;
  line-height: 1;
  transition-duration: var(--adv-save-motion-duration, 180ms);
  white-space: nowrap;
}

.save-pagination__button--system {
  min-width: 5.25rem;
  gap: 0.35rem;
  font-family: inherit;
}

.save-pagination__button:hover,
.save-pagination__button.active {
  background: var(--adv-c-primary-light);
}

@media (max-width: 800px) {
  .save-pagination__inner {
    justify-content: flex-start;
  }
}
</style>
