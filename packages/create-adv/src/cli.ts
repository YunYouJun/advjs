import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import consola from 'consola'
import { colors } from 'consola/utils'
import { execa } from 'execa'
import minimist from 'minimist'
import path from 'pathe'
import prompts from 'prompts'
import { version as advjsVersion } from '../../advjs/package.json'
import { version } from '../package.json'
import { renameFiles, TEMPLATES } from './config'
import { copy, emptyDir, formatTargetDir, isEmpty, isValidPackageName, pkgFromUserAgent, toValidPackageName } from './utils'

export async function init() {
  const argv = minimist(process.argv.slice(2), {
    string: ['_', 'template', 'port'],
    boolean: ['yes', 'help', 'version'],
    alias: { template: 't', yes: 'y', port: 'p', help: 'h', version: 'v' },
  })
  if (argv.help) {
    consola.log(`Usage: create-adv [directory] [--template adv|plugin|theme] [--yes]\n\n--yes, -y       Use defaults; never overwrite, install, or start automatically\n--template, -t  Select a project, plugin, or remote starter theme\n--port, -p      Dev server port when choosing to install and start\n--version, -v   Print version`)
    return
  }
  if (argv.version) {
    consola.log(version)
    return
  }

  const cwd = process.cwd()
  const argTargetDir = formatTargetDir(argv._[0]?.toString())
  const onCancel = () => {
    throw new Error('Operation cancelled')
  }
  let template = TEMPLATES.find(template => template.name === argv.template)
  if (argv.template && !template)
    throw new Error(`Unknown template "${argv.template}". Choose: ${TEMPLATES.map(template => template.name).join(', ')}`)

  consola.log(`\n  ${colors.bold('🎮 ADV.JS')}  ${colors.blue(`v${version}`)}\n`)
  if (!template && !argv.yes) {
    const answer = await prompts({
      type: 'select',
      name: 'template',
      message: 'Select a type:',
      choices: TEMPLATES.map(template => ({
        title: template.color(template.display) + colors.dim(` - ${template.desc}`),
        value: template,
      })),
      initial: 0,
    }, { onCancel })
    template = answer.template
  }
  template ??= TEMPLATES[0]

  let targetDir = argTargetDir || `${template.prefix || ''}${template.initial}`
  if (!argTargetDir && !argv.yes) {
    const answer = await prompts({
      type: 'text',
      name: 'name',
      message: template.message,
      initial: template.initial,
    }, { onCancel })
    targetDir = `${template.prefix || ''}${formatTargetDir(answer.name) || template.initial}`
  }
  // An explicit path is always used verbatim, including absolute paths and '.'.
  const root = path.resolve(cwd, targetDir)
  const projectName = path.basename(root)
  let packageName = toValidPackageName(projectName) || 'advjs-project'
  if (!argv.yes && !isValidPackageName(projectName)) {
    const answer = await prompts({
      type: 'text',
      name: 'packageName',
      message: 'Package name:',
      initial: packageName,
      validate: name => isValidPackageName(name) || 'Invalid package.json name',
    }, { onCancel })
    packageName = answer.packageName
  }

  if (fs.existsSync(root)) {
    if (!fs.statSync(root).isDirectory())
      throw new Error(`Target "${root}" is not a directory`)
    if (!isEmpty(root)) {
      if (argv.yes)
        throw new Error(`Target directory "${root}" is not empty. Choose an empty directory or run interactively.`)
      const { overwrite } = await prompts({
        type: 'confirm',
        name: 'overwrite',
        message: `Target directory "${root}" is not empty. Remove existing files and continue?`,
        initial: false,
      }, { onCancel })
      if (!overwrite)
        throw new Error('Operation cancelled')
      emptyDir(root)
    }
  }

  if (template.customInit) {
    await template.customInit({ themeName: packageName.replace(/^advjs-theme-/, ''), targetDir: root })
  }
  else {
    const templateDir = fileURLToPath(new URL(`../templates/template-${template.name}/`, import.meta.url))
    fs.mkdirSync(root, { recursive: true })
    for (const file of fs.readdirSync(templateDir)) {
      if (file !== 'package.json')
        copy(path.join(templateDir, file), path.join(root, renameFiles[file] ?? file))
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json'), 'utf8').replaceAll('$ADVJS_VERSION', advjsVersion))
    pkg.name = packageName
    fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  }

  consola.log(`  Done. Created ${root}\n`)
  const pkgManager = pkgFromUserAgent(process.env.npm_config_user_agent)?.name || 'npm'
  const { install } = argv.yes
    ? { install: false }
    : await prompts({
        type: 'confirm',
        name: 'install',
        initial: false,
        message: 'Install and start it now?',
      }, { onCancel })
  if (install) {
    const { agent } = await prompts({
      name: 'agent',
      type: 'select',
      message: 'Choose the package manager',
      choices: ['npm', 'yarn', 'pnpm'].map(value => ({ value, title: value })),
      initial: 2,
    }, { onCancel })
    await execa(agent, ['install'], { stdio: 'inherit', cwd: root })
    const devArgs = ['run', 'dev']
    if (argv.port)
      devArgs.push(...(agent === 'npm' ? ['--'] : []), '--port', argv.port)
    await execa(agent, devArgs, { stdio: 'inherit', cwd: root })
  }
  else {
    if (root !== cwd)
      consola.log(`  cd ${JSON.stringify(path.relative(cwd, root))}`)
    consola.log(`  ${pkgManager}${pkgManager === 'yarn' ? '' : ' install'}`)
    consola.log(`  ${pkgManager} run dev\n`)
  }
}
