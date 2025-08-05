<script setup lang="ts">
// webcontainer

import consola from 'consola'
import { onMounted } from 'vue'
import { useAdvWebContainer } from '../../../packages/webcontainer/src/index'

const { webContainerRef, installDependencies, build, mount, state, downloadIndexHtml } = useAdvWebContainer()

onMounted(async () => {
  await mount()

  if (!webContainerRef.value) {
    consola.error('WebContainer is not initialized')
    return
  }

  const packageJSON = await webContainerRef.value.fs.readFile(
    'package.json',
    'utf-8',
  )
  consola.info(packageJSON)
})
</script>

<template>
  <div>
    Web Container

    <div>
      Installed: {{ state.depsInstalled }}

      Built: {{ state.built }}
    </div>

    <AdvButton @click="installDependencies">
      Install Dependencies
    </AdvButton>

    <AdvButton @click="build">
      Build
    </AdvButton>

    <AdvButton @click="downloadIndexHtml">
      Download index.html
    </AdvButton>
  </div>
</template>
