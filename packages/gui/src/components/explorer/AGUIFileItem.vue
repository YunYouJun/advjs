<script lang="ts" setup>
import { computed, ref } from 'vue'

const props = defineProps<{
  name: string
  icon?: string
  size?: number
}>()

const icon = ref(props.icon || 'i-vscode-icons:default-file')

const cssVars = computed(() => ({
  '--icon-size': `${props.size}px`,
}))
</script>

<template>
  <div class="agui-file-item h-full flex flex-col" :style="cssVars">
    <div class="flex flex-row">
      <div
        class="icon"
        :class="icon"
      />
    </div>

    <div class="agui-file-name">
      {{ name }}
    </div>
  </div>
</template>

<style lang="scss">
.agui-file-item {
  display: flex;
  flex-direction: column;
  align-items: center;

  .icon {
    font-size: var(--icon-size, 32px);
  }

  .agui-file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    font-size: 14px;
  }
}
</style>
