<script setup lang="ts">
const fileStore = useFileStore()
</script>

<template>
  <div class="w-full flex items-center justify-evenly">
    <div
      class="inline-flex flex-col cursor-pointer items-center gap-2"
      @click="fileStore.openAdvConfigFile"
    >
      <div class="glow-icon text-8xl">
        <div
          class="i-vscode-icons:file-type-jsonld"
        />
      </div>
      <div class="text-sm op-50">
        Open Local ADV Config File
      </div>
    </div>

    <div
      class="inline-flex flex-col cursor-pointer items-center gap-2"
      @click="fileStore.onlineAdvConfigFileDialogOpen = true"
    >
      <div class="glow-icon text-8xl">
        <div
          class="i-vscode-icons:file-type-aspx"
        />
      </div>
      <div class="text-sm op-50">
        Open Online ADV Config File
      </div>
    </div>
  </div>
</template>

<style scoped>
.glow-icon {
  will-change: filter;
  transition: filter 300ms;

  &:hover {
    filter: drop-shadow(0 0 1rem rgba(252, 171, 49, 0.9));
  }
}
</style>
