import type { Terminal } from '@xterm/xterm'
import { WebContainer } from '@webcontainer/api'
import { ref, shallowRef } from 'vue'
import { advProjectFiles } from './files'

/**
 * adv webContainer
 *
 * mount()
 */
export function useAdvWebContainer() {
  const webContainerRef = shallowRef<WebContainer>()

  const state = ref({
    /**
     * 是否已挂载
     */
    mounted: false,
    /**
     * 依赖是否已安装
     */
    depsInstalled: false,
    /**
     * 是否已构建
     */
    built: false,
  })

  /**
   * Mount the WebContainer with the ADV project files.
   */
  async function mount() {
    state.value.mounted = false
    webContainerRef.value = await WebContainer.boot({
      // You can pass options here if needed
    })

    await webContainerRef.value.mount(advProjectFiles)
    state.value.mounted = true
  }

  async function installDependencies(terminal?: Terminal) {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    // Logic to install dependencies
    const installProcess = await webContainerRef.value.spawn('pnpm', ['install'])
    const installExitCode = await installProcess.exit

    if (installExitCode !== 0) {
      console.error('Failed to install dependencies', installExitCode)
    }
    else {
      state.value.depsInstalled = true
    }

    installProcess.output.pipeTo(new WritableStream({
      write(data) {
        if (terminal) {
          terminal.write(data)
        }
        else {
          // eslint-disable-next-line no-console
          console.log(data)
        }
      },
    }))
  }

  async function build(terminal?: Terminal) {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    const buildProcess = await webContainerRef.value.spawn('pnpm', ['build'])
    const buildExitCode = await buildProcess.exit

    if (buildExitCode !== 0) {
      console.error('Failed to build project', buildExitCode)
    }
    else {
      state.value.built = true
    }

    buildProcess.output.pipeTo(new WritableStream({
      write(data) {
        if (terminal) {
          terminal.write(data)
        }
        else {
          // eslint-disable-next-line no-console
          console.log(data)
        }
      },
    }))
  }

  async function downloadIndexHtml() {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    const indexHtml = await webContainerRef.value.fs.readFile('dist/index.html', 'utf-8')
    // download the file with indexHtml content
    const blob = new Blob([indexHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'index.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    state,
    webContainerRef,
    mount,
    installDependencies,
    build,
    downloadIndexHtml,
  }
}
