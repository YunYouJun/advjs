<script lang="ts" setup>
import AGUIDisclosureChevron from './disclosure/AGUIDisclosureChevron.vue'
import AGUIForm from './form/AGUIForm.vue'
import './disclosure/disclosure.scss'

defineProps<{
  icon?: string
  title: string
}>()
</script>

<template>
  <details class="agui-details">
    <slot name="summary">
      <summary class="agui-summary agui-disclosure-heading">
        <AGUIDisclosureChevron />
        <span v-if="icon" class="agui-summary-icon agui-disclosure-icon" :class="icon" aria-hidden="true" />
        <span class="title agui-disclosure-title">{{ title }}</span>
      </summary>
    </slot>
    <AGUIForm class="content">
      <slot />
    </AGUIForm>
  </details>
</template>

<style lang="scss">
.agui-details {
  width: 100%;
  min-width: 0;
  border-top: 1px solid var(--agui-c-divider-light);
  color: var(--agui-c-text-1);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
  container: agui-properties / inline-size;

  &:first-child {
    border-top: none;
  }

  > .agui-summary {
    list-style: none;

    &::marker {
      content: '';
    }

    &::-webkit-details-marker {
      display: none;
    }
  }

  > .content {
    padding: var(--agui-space-2) var(--agui-space-3);
  }
}
</style>
