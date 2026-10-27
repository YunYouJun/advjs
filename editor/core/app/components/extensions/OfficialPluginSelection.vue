<script setup lang="ts">
import type { OfficialPluginView } from './official-plugin-presentation'
import { nextTick, useTemplateRef } from 'vue'
import OfficialPluginRow from './OfficialPluginRow.vue'

const props = defineProps<{ items: OfficialPluginView[], locale: string, detailsId: string }>()
const selectedId = defineModel<string>('selectedId', { required: true })
const list = useTemplateRef<HTMLUListElement>('list')

async function navigate(event: KeyboardEvent) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
    return
  const target = event.target
  if (!(target instanceof HTMLElement))
    return
  const button = target.closest<HTMLButtonElement>('button[data-plugin-choice]')
  const buttons = Array.from(list.value?.querySelectorAll<HTMLButtonElement>('button[data-plugin-choice]') ?? [])
  const index = button ? buttons.indexOf(button) : -1
  if (index < 0)
    return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
  selectedId.value = props.items[next]!.entry.id
  await nextTick()
  buttons[next]?.focus()
}
</script>

<template>
  <nav class="official-plugin-selection" :aria-label="locale === 'zh-CN' ? '选择官方插件' : 'Choose an official plugin'" data-testid="official-plugin-selection">
    <ul ref="list" class="official-plugin-options" @keydown="navigate">
      <OfficialPluginRow v-for="item in items" :key="item.entry.id" :item="item" :locale="locale" :details-id="detailsId" :selected="selectedId === item.entry.id" @select="selectedId = item.entry.id" />
    </ul>
  </nav>
</template>

<style scoped>
.official-plugin-selection {
  min-width: 0;
}
.official-plugin-options {
  display: grid;
  gap: var(--agui-space-1);
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
