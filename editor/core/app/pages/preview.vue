<script lang="ts" setup>
// nuxt get query
const route = useRoute()
const fileUrl = computed(() => decodeURI(route.query.fileUrl as string))
const type = computed(() => route.query.type as string)

onBeforeMount(() => {
  // @TODO
  // import('@google/model-viewer')
})

const fileContent = computedAsync(async () => {
  const json = await fetch(fileUrl.value).then(res => res.json())
  return JSON.stringify(json, null, 2)
})

const isGlTF = computed(() => ['gltf', 'glb'].includes(type.value))
</script>

<template>
  <div flex class="grid-cols-2 h-full">
    <model-viewer
      v-if="fileUrl && isGlTF"
      class="h-full w-full"
      :src="fileUrl"
      :alt="fileUrl"
      camera-controls auto-rotate
    />

    <div class="h-full w-full">
      <ClientOnly>
        <MonacoEditor
          class="h-full w-full"
          :model-value="fileContent"
          :options="{
            theme: 'vs-dark',
            readOnly: true,
          }" lang="json"
        />
      </ClientOnly>
    </div>
  </div>
</template>
