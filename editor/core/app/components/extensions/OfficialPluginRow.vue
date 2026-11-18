<script setup lang="ts">
import type { OfficialPluginView } from './official-plugin-presentation'
import AGUITag from '@advjs/gui/components/tag/AGUITag.vue'
import { computed, useId } from 'vue'
import { officialPluginText } from '../../extensions/official-plugins'

const props = defineProps<{ item: OfficialPluginView, locale: string, selected: boolean, detailsId: string }>()
defineEmits<{ select: [] }>()
const id = useId()
const summary = computed(() => officialPluginText(props.item.entry.capabilities, props.locale))
</script>

<template>
  <li class="official-plugin-row" :data-official-plugin="item.entry.id">
    <button
      type="button" class="official-plugin-choice" :class="{ 'is-selected': selected }"
      :aria-pressed="selected" :aria-controls="detailsId" :aria-label="item.entry.name"
      :aria-describedby="`${id}-summary ${id}-status`" :tabindex="selected ? 0 : -1"
      :data-plugin-choice="item.entry.id" :data-testid="`official-plugin-select-${item.entry.id}`" @click="$emit('select')"
    >
      <span class="official-plugin-choice-heading">
        <strong class="official-plugin-name">{{ item.entry.name }}</strong>
        <AGUITag :id="`${id}-status`" :tone="item.status.tone" :data-testid="`official-plugin-state-${item.entry.id}`" role="status">{{ item.status.label }}</AGUITag>
      </span>
      <span :id="`${id}-summary`" class="official-plugin-summary" :title="summary">{{ summary }}</span>
    </button>
  </li>
</template>

<style scoped>
.official-plugin-row {
  min-width: 0;
}
.official-plugin-choice {
  display: grid;
  gap: var(--agui-space-1);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--agui-control-height);
  padding: var(--agui-space-2);
  border: 0;
  border-radius: var(--agui-radius-sm);
  background: transparent;
  color: var(--agui-c-text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--agui-motion-duration),
    color var(--agui-motion-duration);
}
.official-plugin-choice:hover {
  background: var(--agui-c-control-hover);
}
.official-plugin-choice.is-selected {
  background: var(--agui-c-selection);
  color: var(--agui-c-selection-text);
}
.official-plugin-choice:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: -2px;
}
.official-plugin-choice-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--agui-space-1) var(--agui-space-2);
  min-width: 0;
}
.official-plugin-name {
  font-size: var(--agui-font-size-title);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.official-plugin-summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
}
.official-plugin-choice.is-selected .official-plugin-summary {
  color: var(--agui-c-selection-text);
}
</style>
