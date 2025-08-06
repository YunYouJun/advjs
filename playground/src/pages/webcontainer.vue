<script setup lang="ts">
import { isClient } from '@vueuse/core'

// webcontainer
import { consola } from 'consola'
import { useAdvWebContainer } from '../../../packages/webcontainer/src/index'
import '@xterm/xterm/css/xterm.css'

const terminalElRef = ref<HTMLElement>()
const {
  webContainerRef,
  installDependencies,
  build,
  mount,
  state,
  downloadIndexHtml,
  initTerminal,
} = useAdvWebContainer()

onMounted(async () => {
  consola.info('mounted')

  if (isClient) {
    consola.info('Mounting WebContainer...')
    await mount()

    consola.info('Init Terminal')
    await initTerminal(terminalElRef.value)

    if (!webContainerRef.value) {
      consola.error('WebContainer is not initialized')
      return
    }

    const packageJSON = await webContainerRef.value.fs.readFile(
      'package.json',
      'utf-8',
    )
    consola.info(packageJSON)
  }
})

async function installAndBuild() {
  await installDependencies()
  await build()
}
</script>

<template>
  <div>
    Web Container

    {{ state }}

    <AdvButton @click="installDependencies()">
      Install Dependencies
    </AdvButton>

    <AdvButton @click="build()">
      Build
    </AdvButton>

    <AdvButton @click="installAndBuild()">
      安装并构建
    </AdvButton>

    <AdvButton @click="downloadIndexHtml()">
      Download index.html
    </AdvButton>

    <div ref="terminalElRef" class="terminal" />
  </div>
</template>

<style>
.terminal {
  background-color: black;
  padding: 4px;
  border-radius: 4px;
  overflow: hidden;
}
</style>
