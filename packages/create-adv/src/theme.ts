/* eslint-disable no-console */
import { colors } from 'consola/utils'
import { execa } from 'execa'
import prompts from 'prompts'

const starterTheme = {
  name: 'starter',
  display: `Starter`,
  repo: 'https://github.com/advjs/advjs-theme-starter',
}

export async function initTheme(options: {
  themeName?: string
}) {
  const defaultThemeName = starterTheme.name
  let themeName = options.themeName || defaultThemeName
  if (!themeName) {
    /**
     * @type {{ theme: string }}
     */
    const { theme } = await prompts({
      type: 'text',
      name: 'theme',
      message: 'Theme name: advjs-theme-',
      initial: defaultThemeName,
    })
    themeName = theme || defaultThemeName
  }

  const targetDir = `advjs-theme-${themeName!.trim()}`

  console.log(`  ${colors.dim('npx')} ${colors.gray('degit')} ${colors.blue(starterTheme.repo)} ${colors.yellow(targetDir)}`)
  await execa('npx', ['degit', starterTheme.repo, targetDir], { stdio: 'inherit' })

  console.log()
  console.log(`  ${colors.bold('Check it')}:`)
  console.log()
  console.log(`- Change ${colors.bold('author')} name in ${colors.yellow('LICENSE')} & ${colors.green('package.json')} & ${colors.blue('.github')}`)
  console.log(`- Change ${colors.blue('adv.config.ts')} theme: ${colors.yellow('starter')} to ${colors.cyan(`${themeName}`)}`)
  console.log(`- Rename ${colors.yellow(`advjs-theme-${themeName}`)} to ${colors.cyan(`advjs-theme-${themeName}`)}`)
  console.log()
  console.log(`  ${colors.cyan('✨')}`)
  console.log()

  return `advjs-theme-${themeName}`
}
