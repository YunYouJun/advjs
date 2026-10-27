<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ title: string, description?: string, step?: string | number }>()
const id = useId()
</script>

<template>
  <section class="agui-section" :aria-labelledby="`${id}-title`" :aria-describedby="description ? `${id}-description` : undefined">
    <header class="agui-section__header">
      <div class="agui-section__heading">
        <h3 :id="`${id}-title`" class="agui-section__title">
          <span v-if="step !== undefined" class="agui-section__step">{{ step }}</span>
          <span>{{ title }}</span>
        </h3>
        <p v-if="description" :id="`${id}-description`" class="agui-section__description">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="agui-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="agui-section__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="agui-section__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style lang="scss" scoped>
.agui-section {
  min-width: 0;
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-md);
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-text-1);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
}
.agui-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--agui-space-2);
  padding: var(--agui-space-3);
  border-bottom: 1px solid var(--agui-c-divider-light);
}
.agui-section__heading {
  flex: 1 1 160px;
  min-width: 0;
}
.agui-section__title {
  display: flex;
  align-items: center;
  gap: var(--agui-space-2);
  margin: 0;
  font-size: var(--agui-font-size-title);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.agui-section__step {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: var(--agui-control-height);
  min-height: var(--agui-control-height);
  padding-inline: var(--agui-space-1);
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-sm);
  background: var(--agui-c-bg-soft);
  font-size: var(--agui-font-size-body);
  font-variant-numeric: tabular-nums;
}
.agui-section__description {
  margin: var(--agui-space-1) 0 0;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.agui-section__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--agui-space-1);
  max-width: 100%;
  min-width: 0;
}
.agui-section__content,
.agui-section__footer {
  display: grid;
  gap: var(--agui-space-2);
  min-width: 0;
  padding: var(--agui-space-3);
}
.agui-section__footer {
  border-top: 1px solid var(--agui-c-divider-light);
}
</style>
