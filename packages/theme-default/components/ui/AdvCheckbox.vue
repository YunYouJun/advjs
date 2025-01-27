<script setup lang="ts">
import type { AdvCheckboxProps } from '@advjs/theme-default'
import { useAudioStore } from '@advjs/client'
import { watch } from 'vue'

const p = withDefaults(defineProps<{ props: AdvCheckboxProps }>(), {
  props: () => ({ checked: false }),
})

const audio = useAudioStore()

watch(() => [p.props.checked], () => {
  if (p.props.checked)
    audio.popUpOn.play()
  else
    audio.popUpOff.play()
})

// do not need emit update:checked, because it is controlled by parent
</script>

<template>
  <span class="inline-flex cursor-pointer" @click="props.onClick">
    <AdvIcon v-if="props.checked">
      <div i-ri-checkbox-line />
    </AdvIcon>
    <AdvIcon v-else>
      <div i-ri-checkbox-blank-line />
    </AdvIcon>
  </span>
</template>
