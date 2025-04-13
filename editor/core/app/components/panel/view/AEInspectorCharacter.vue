<script setup lang="ts">
const characterStore = useCharacterStore()

const fileContent = computed(() => {
  return JSON.stringify(characterStore.selectedCharacter, null, 2)
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between gap-2 p-2">
      <div class="flex items-center gap-2">
        <div i-ri-user-line />
        <span>Character</span>
      </div>

      <div class="flex items-center gap-2">
        <div>
          {{ characterStore.selectedCharacter?.name }}
        </div>
        <div class="text-xs op-80">
          {{ characterStore.selectedCharacter?.id }}
        </div>
      </div>
    </div>

    <MonacoEditor
      class="h-full flex flex-grow"
      :model-value="fileContent"
      lang="json"
      :options="{ theme: 'vs-dark', readOnly: true }"
      :editor-options="{ automaticLayout: true }"
    />
  </div>
</template>
