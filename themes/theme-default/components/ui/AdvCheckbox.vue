<script setup lang="ts">
import type { AdvCheckboxProps } from '@advjs/theme-default'
import { useAudioStore } from '@advjs/client'
import { watch } from 'vue'

const p = withDefaults(defineProps<{
  props?: AdvCheckboxProps
}>(), {
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
  <button type="button" role="checkbox" class="adv-checkbox" :aria-checked="props.checked" @click="props.onClick">
    <AdvIcon v-if="props.checked">
      <div i-ri-checkbox-line />
    </AdvIcon>
    <AdvIcon v-else>
      <div i-ri-checkbox-blank-line />
    </AdvIcon>
  </button>
</template>

<style scoped>
.adv-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25em;
  height: 2.25em;
  padding: 0;
  color: inherit;
  font: inherit;
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
  cursor: pointer;
}

.adv-checkbox :deep(.adv-icon) {
  font-size: 1.5em;
}

.adv-checkbox[aria-checked='true'] {
  color: var(--adv-c-primary);
}

.adv-checkbox:hover {
  background: var(--adv-control-hover-bg, color-mix(in srgb, currentColor 10%, transparent));
}
</style>
