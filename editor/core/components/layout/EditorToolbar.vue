<script setup lang="ts">
import {
  ToolbarRoot,
  ToolbarSeparator,
} from 'radix-vue'

const app = useAppStore()
</script>

<template>
  <ToolbarRoot
    class="shadow-blackA7 w-full flex p-1"
    aria-label="Formatting options"
  >
    <div flex gap="1">
      <AGUIButton icon="i-mdi-account-circle">
        YunYouJun
      </AGUIButton>
      <AGUIIconButton size="mini" icon="i-ri-puzzle-line" />
    </div>
    <ToolbarSeparator class="bg-mauve6 mx-[10px] w-[1px]" />
    <AGUIButton class="ml-auto" @click="app.resetLayout">
      Reset Layout
    </AGUIButton>
  </ToolbarRoot>
</template>
