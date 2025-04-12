<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  label?: string
}>()

const switchState = defineModel({
  type: Boolean,
  default: false,
})
</script>

<template>
  <div class="flex items-center gap-2">
    <label
      class="select-none pr-2 text-sm text-stone-700 leading-none dark:text-white"
      for="airplane-mode"
    >
      <slot name="label">
        {{ label }}
      </slot>
    </label>

    <SwitchRoot
      v-model="switchState"
      class="transition-[background] relative h-[20px] w-[32px] flex border border-stone-300 rounded-full shadow-sm dark:border-stone-700 data-[state=checked]:border-stone-700 focus-within:border-stone-800 data-[state=checked]:bg-stone-800 data-[state=unchecked]:bg-stone-300 focus-within:shadow-[0_0_0_1px] focus-within:shadow-stone-800 focus-within:outline-none dark:data-[state=checked]:bg-stone-700 dark:data-[state=unchecked]:bg-stone-800"
    >
      <SwitchThumb
        class="my-auto h-3.5 w-3.5 flex translate-x-0.5 items-center justify-center rounded-full bg-white text-xs shadow-xl transition-transform will-change-transform data-[state=checked]:translate-x-full"
      />
    </SwitchRoot>
  </div>
</template>
