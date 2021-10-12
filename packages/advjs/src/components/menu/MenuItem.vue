<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">{{ props.label }}</label>
  </div>
  <div class="col-span-8 text-left flex items-center">
    <AdvCheckbox v-if="props.item.type === 'checkbox'" :checked="checked" @click="item.click"></AdvCheckbox>
  </div>
</template>

<script setup lang="ts">
// import type { AdvCheckbox, AdvSelect } from 'advjs/types/ui'

import { MaybeRef } from '@vueuse/core'

// type SettingsMenuItem = AdvCheckbox | AdvSelect

const props = withDefaults(defineProps<{
  label: string
  item: {
    type: string
    checked: MaybeRef<boolean>
    click?: () => void
  }
}>(), {
  label: 'Label',
  item: () => {
    return {
      type: 'checkbox',
      checked: false,
    }
  },
})

const checked = ref(props.item.checked)
</script>
