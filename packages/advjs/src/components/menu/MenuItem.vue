<template>
  <div col="span-6" class="adv-menu-item" text="2xl">
    <label :for="item.label">{{ item.label }}</label>
  </div>
  <div col="span-6" class="flex items-center" p="x-2">
    <AdvCheckbox v-if="item.type === 'checkbox'" :checked="checked" @click="item.click" />
    <AdvSelect v-else-if="item.type === 'select'" :selected="item.selected" :options="item.options" :checked="checked" :change="item.change" />
  </div>
</template>

<script setup lang="ts">
// import type { AdvCheckbox, AdvSelect } from 'advjs/types/ui'

import type { MaybeRef } from '@vueuse/core'

// type SettingsMenuItem = AdvCheckbox | AdvSelect

export interface MenuItem {
  label: string
  type: string
}

export interface AdvCheckbox {
  type: 'checkbox'
  checked?: MaybeRef<boolean>
  click?: () => void
}

export interface AdvSelect {
  type: 'select'
  selected: string
  options: []
  change: () => void
}

const props = withDefaults(defineProps<{
  item: MenuItem & (AdvCheckbox | AdvSelect)
}>(), {
  item: () => {
    return {
      label: 'Label',
      type: 'checkbox',
      checked: false,
    }
  },
})

const checked = computed(() => {
  if (props.item.type === 'checkbox')
    return props.item.checked
  else
    return false
})
</script>
