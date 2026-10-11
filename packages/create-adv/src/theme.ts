import consola from 'consola'
import { colors } from 'consola/utils'
import { execa } from 'execa'
import prompts from 'prompts'

export const THEME_HELPER = 'degit@3.10.0'

const starterTheme = {
  name: 'starter',
  display: `Starter`,
  repo: 'https://github.com/advjs/advjs-theme-starter',
}

export async function initTheme(options: {
  themeName?: string
  targetDir: string
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

  const targetDir = options.targetDir

  consola.log(`  ${colors.dim('npx')} ${colors.gray(`--yes ${THEME_HELPER}`)} ${colors.blue(starterTheme.repo)} ${colors.yellow(targetDir)}`)
  await execa('npx', ['--yes', THEME_HELPER, starterTheme.repo, targetDir], { stdio: 'inherit' })

  consola.log('')
  consola.log(`  ${colors.bold('Check it')}:`)
  consola.log('')
  consola.log(`- Change ${colors.bold('author')} name in ${colors.yellow('LICENSE')} & ${colors.green('package.json')} & ${colors.blue('.github')}`)
  consola.log(`- Change ${colors.blue('adv.config.ts')} theme: ${colors.yellow('starter')} to ${colors.cyan(`${themeName}`)}`)
  consola.log(`- Rename ${colors.yellow(`advjs-theme-${themeName}`)} to ${colors.cyan(`advjs-theme-${themeName}`)}`)
  consola.log('')
  consola.log(`  ${colors.cyan('✨')}`)
  consola.log('')

  return `advjs-theme-${themeName}`
}
