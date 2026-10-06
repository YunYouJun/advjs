<script lang="ts" setup>
const nativeMenu = import.meta.client && window.advDesktop?.nativeMenu === true
const { menus } = useEditorMenubar()
</script>

<template>
  <AGUIMenubar v-if="!nativeMenu" class="border-b-1px border-b-black/80" :menus="menus" />
</template>
