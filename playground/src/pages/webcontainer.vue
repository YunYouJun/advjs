<script setup lang="ts">
// webcontainer

import consola from 'consola'
import { onMounted } from 'vue'
import { createAdvWebContainer } from '../../../packages/webcontainer/src'

// await
const advWebContainer = shallowRef<Awaited<ReturnType<typeof createAdvWebContainer>>>()

onMounted(async () => {
  advWebContainer.value = await createAdvWebContainer()
  if (!advWebContainer.value) {
    consola.error('Failed to create AdvWebContainer instance')
    return
  }

  const { mount, webcontainerInstance } = advWebContainer.value
  await mount()

  const packageJSON = await webcontainerInstance.fs.readFile(
    'package.json',
    'utf-8',
  )
  consola.info(packageJSON)
  // await installDependencies()
  // await build()
})
</script>

<template>
  <div>
    Web Container

    <AdvButton @click="advWebContainer?.installDependencies">
      Install Dependencies
    </AdvButton>

    <AdvButton @click="advWebContainer?.build">
      Build
    </AdvButton>
  </div>
</template>
