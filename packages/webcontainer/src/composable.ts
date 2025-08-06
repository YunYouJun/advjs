import type { Terminal } from '@xterm/xterm'
import { isClient } from '@vueuse/core'
import { WebContainer } from '@webcontainer/api'
import * as xterm from '@xterm/xterm'
import { ref, shallowRef } from 'vue'
import { createAdvProjectFiles } from './files'

/**
 * 步骤状态
 */
export type StepStatus = 'starting' | 'mounting' | 'installing' | 'building' | 'ready'

/**
 * 每个阶段的状态
 */
export type StageStatus = 'running' | 'done' | ''

/**
 * adv webContainer
 *
 * mount()
 */
export function useAdvWebContainer() {
  const storyId = ref('')

  const webContainerRef = shallowRef<WebContainer>()
  const terminalRef = shallowRef<Terminal>()
  const { Terminal } = xterm

  const state = ref<{
    /**
     * 当前步骤状态
     */
    status: StepStatus
    /**
     * 挂载状态
     */
    mount: StageStatus
    /**
     * 安装依赖状态
     */
    installDependencies: StageStatus
    /**
     * 构建状态
     */
    build: StageStatus
  }>({
    status: 'starting' as StepStatus,
    mount: '',
    installDependencies: '',
    build: '',
  })

  /**
   * 初始化终端
   */
  async function initTerminal(el?: HTMLElement) {
    if (!isClient)
      return

    const { FitAddon } = await import('@xterm/addon-fit')
    const fitAddon = new FitAddon()
    const terminal = new Terminal({
      convertEol: true,
    })
    terminal.loadAddon(fitAddon)
    terminal.open(el || document.querySelector('.terminal')!)

    terminalRef.value = terminal
    fitAddon.fit()

    const shellProcess = await startShell(terminal)
    window.addEventListener('resize', () => {
      fitAddon.fit()
      shellProcess.resize({
        cols: terminal.cols,
        rows: terminal.rows,
      })
    })
  }

  async function startShell(terminal = terminalRef.value) {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    const shellProcess = await webContainerRef.value.spawn('jsh')
    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal?.write(data)
        },
      }),
    )

    // interactive
    // const input = shellProcess.input.getWriter()
    // terminal?.onData((data) => {
    //   input.write(data)
    // })

    return shellProcess
  };

  /**
   * Mount the WebContainer with the ADV project files.
   */
  async function mount() {
    state.value.status = 'mounting'

    state.value.mount = 'running'
    const advProjectFiles = createAdvProjectFiles({ storyId: storyId.value })
    webContainerRef.value = await WebContainer.boot({
      // You can pass options here if needed
    })

    await webContainerRef.value.mount(advProjectFiles)
    state.value.mount = 'done'
  }

  async function installDependencies(terminal: Terminal | undefined = terminalRef.value) {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    state.value.status = 'installing'
    state.value.installDependencies = 'running'
    // Logic to install dependencies
    const installProcess = await webContainerRef.value.spawn('pnpm', ['install'])
    const installExitCode = await installProcess.exit

    if (installExitCode !== 0) {
      console.error('Failed to install dependencies', installExitCode)
    }
    else {
      state.value.installDependencies = 'done'
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

  async function build(terminal: Terminal | undefined = terminalRef.value) {
    if (!webContainerRef.value) {
      throw new Error('WebContainer is not initialized. Call mount() first.')
    }

    state.value.status = 'building'
    state.value.build = 'running'
    const buildProcess = await webContainerRef.value.spawn('pnpm', ['build'])
    const buildExitCode = await buildProcess.exit

    if (buildExitCode !== 0) {
      console.error('Failed to build project', buildExitCode)
    }
    else {
      state.value.build = 'done'
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
    storyId,

    state,
    terminalRef,
    webContainerRef,

    initTerminal,
    startShell,

    mount,
    installDependencies,
    build,
    downloadIndexHtml,
  }
}
