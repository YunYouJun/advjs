import { WebContainer } from '@webcontainer/api'
import { advProjectFiles } from './files'

export async function createAdvWebContainer() {
  const webcontainerInstance = await WebContainer.boot({
  // You can pass options here if needed
  })

  async function mount() {
    await webcontainerInstance.mount(advProjectFiles)
  }

  // startBuildServer

  async function installDependencies() {
    // Logic to install dependencies
    const installProcess = await webcontainerInstance.spawn('pnpm', ['install'])
    const installExitCode = await installProcess.exit

    if (installExitCode !== 0) {
      console.error('Failed to install dependencies', installExitCode)
    }

    installProcess.output.pipeTo(new WritableStream({
      write(data) {
        // eslint-disable-next-line no-console
        console.log(data)
      },
    }))
  }

  async function build() {
    await webcontainerInstance.spawn('pnpm', ['build'])
  }

  return {
    webcontainerInstance,
    mount,
    installDependencies,
    build,
  }
}
