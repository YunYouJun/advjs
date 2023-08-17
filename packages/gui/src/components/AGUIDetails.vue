<script lang="ts" setup>
defineProps<{ title: string }>()
</script>

<template>
  <details class="agui-details">
    <slot name="summary">
      <summary
        class="agui-summary text-$agui-c-text-1" font-bold text-xs
        cursor-pointer
      >
        <span ml-1>
          {{ title }}
        </span>
      </summary>
    </slot>
    <div pl="6" py-1.5>
      <slot />
    </div>
  </details>
</template>
