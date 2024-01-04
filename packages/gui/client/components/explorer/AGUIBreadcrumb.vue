<script lang="ts" setup>
defineProps<{
  items: {
    text: string
    href?: string
  }[]
}>()
</script>

<template>
  <nav class="agui-breadcrumb-container" aria-label="breadcrumb">
    <ol class="agui-breadcrumb">
      <li v-for="(item, index) in items" :key="index" class="agui-breadcrumb-item" :class="{ active: index === items.length - 1 }">
        <a v-if="index < items.length - 1" :href="item.href">{{ item.text }}</a>
        <span v-else>{{ item.text }}</span>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss">
.agui-breadcrumb-container {
  display: flex;
  background-color: var(--agui-c-bg-panel-title);

  .agui-breadcrumb {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 4px;
    background: transparent;

    font-size: 12px;
    line-height: 1;
  }

  .agui-breadcrumb-item {
    margin: 0;
  }

  .agui-breadcrumb-item + .agui-breadcrumb-item::before {
    content: '>';
    padding: 0 5px;
    color: #6c757d;
  }

  .agui-breadcrumb-item a {
    color: aliceblue;
    text-decoration: none;
  }

  .agui-breadcrumb-item.active a {
    color: #6c757d;
    pointer-events: none;
    cursor: default;
    font-weight: bold;
  }

  .agui-breadcrumb-item.active {
    font-weight: bold;
  }
}
</style>
