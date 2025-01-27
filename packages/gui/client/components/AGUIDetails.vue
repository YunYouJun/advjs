<script lang="ts" setup>
defineProps<{
  icon?: string
  title: string
}>()
</script>

<template>
  <details class="agui-details w-full">
    <slot name="summary">
      <summary
        class="agui-summary text-$agui-c-text-1 leading-3 shadow-sm"
        cursor-pointer text-xs
      >
        <!-- <div :class="collapse" /> -->
        <div v-if="icon" class="mx-1 inline-block" :class="icon" />
        <span ml-1 class="title">
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
  border-top: 1px solid var(--agui-c-border);

  &:first-child {
    border-top: none;
  }

  .agui-summary {
    // display: flex;
    align-items: center;

    // list-style: inside disclosure-closed;

    margin: 0;
    padding: 2px;
    padding-left: 8px;
    user-select: none;
    background-color: var(--agui-c-bg-summary);
    &:hover {
      background-color: var(--agui-c-bg-hover);
    }

    .title {
      display: inline-flex;
      line-height: 1.5;
    }

    &::-webkit-details-marker {
      color: red;
      background: white;
    }
  }

  > .content {
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 10px;
    padding-bottom: 10px;
  }
}
</style>
