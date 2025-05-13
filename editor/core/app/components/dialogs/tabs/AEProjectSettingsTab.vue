<script setup lang="ts">
defineProps<{
  title?: string
}>()

const { properties } = useProjectSettings()
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between">
      <h3 class="inline-flex text-lg font-bold">
        {{ title }}
      </h3>
    </div>

    <AGUIPropertiesForm :properties="properties" />
  </div>
</template>
