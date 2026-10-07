import process from 'node:process'

export function assertDesktopVersion(version) {
  const match = typeof version === 'string' && version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?$/i)
  if (!match || match[4]?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))
    throw new Error(`Invalid desktop version: ${version}. Expected a SemVer version such as 0.1.5 or 0.1.5-beta.1.`)
  return version
}

export function resolveDesktopTarget(options = {}, host = process) {
  const platform = options.platform || host.platform
  const arch = options.arch || host.arch
  if (!['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'].includes(`${platform}-${arch}`))
    throw new Error(`Unsupported desktop target: ${platform}-${arch}. Supported targets: darwin-arm64, darwin-x64, win32-x64, linux-x64.`)
  if (platform !== host.platform || arch !== host.arch)
    throw new Error(`Build ${platform}-${arch} on a matching native runner; this process is ${host.platform}-${host.arch}. Runtime native dependencies cannot be cross-packaged.`)
  return { platform, arch }
}

export function parseDesktopOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--')
      continue
    if (argument === '--rebuild') {
      options.rebuild = true
      continue
    }
    const match = argument.match(/^--(platform|arch)(?:=(.+))?$/)
    if (!match)
      throw new Error(`Unknown desktop option: ${argument}`)
    const value = match[2] || args[++index]
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for --${match[1]}`)
    options[match[1]] = value
  }
  return options
}

export function desktopArtifactName(version, platform, arch) {
  return `advjs-desktop-${assertDesktopVersion(version)}-${platform}-${arch}.zip`
}
