<script setup lang="ts">
import { isClient } from '@vueuse/core'
import { Terminal } from '@xterm/xterm'

// webcontainer
import { consola } from 'consola'
import { useAdvWebContainer } from '../../../packages/webcontainer/src/index'
import '@xterm/xterm/css/xterm.css'

const { webContainerRef, installDependencies, build, mount, state, downloadIndexHtml } = useAdvWebContainer()
const terminalElRef = ref<HTMLElement>()

const terminalRef = shallowRef<Terminal>()

onMounted(async () => {
  consola.info('mounted')

  if (isClient) {
    consola.info('Init Terminal')
    terminalRef.value = new Terminal({
      convertEol: true,
    })
    terminalRef.value.open(terminalElRef.value || document.querySelector('.terminal')!)

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
  }
})
</script>

<template>
  <div>
    Web Container

    <div>
      Mounted: {{ state.mounted }}

      Installed: {{ state.depsInstalled }}

      Built: {{ state.built }}
    </div>

    <AdvButton @click="installDependencies(terminalRef)">
      Install Dependencies
    </AdvButton>

    <AdvButton @click="build(terminalRef)">
      Build
    </AdvButton>

    <AdvButton @click="downloadIndexHtml">
      Download index.html
    </AdvButton>

    <div ref="terminalElRef" class="terminal" />
  </div>
</template>
