<script lang="ts" setup>
const { menus } = useEditorMenubar()
</script>

<template>
  <AGUIMenubar :menus="menus" />

  <!-- dialog -->
  <AEGlobalDialogs />
</template>
