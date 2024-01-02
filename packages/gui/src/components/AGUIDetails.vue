<script lang="ts" setup>
defineProps<{ title: string }>()
</script>

<template>
  <details class="agui-details w-full">
    <slot name="summary">
      <summary
        class="agui-summary text-$agui-c-text-1"
        cursor-pointer text-xs font-bold
      >
        <span ml-1>
          {{ title }}
        </span>
      </summary>
    </slot>
    <div class="content">
      <slot />
    </div>
  </details>
</template>

<style lang="scss">
.agui-details {
  .content {
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 10px;
    padding-bottom: 10px;
  }
}
</style>
