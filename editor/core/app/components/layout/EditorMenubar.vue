<script lang="ts" setup>
const { menus } = useEditorMenubar()
</script>

<template>
  <AGUIMenubar class="border-b-1px border-b-black/80" :menus="menus" />

  <!-- dialog -->
  <AEGlobalDialogs />
</template>
