import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const stage = resolve(root, '.build')
const runtime = resolve(stage, 'runtime')
await rm(stage, { recursive: true, force: true })
await mkdir(resolve(runtime, 'node_modules/.store'), { recursive: true })
const seen = new Map()
const ignored = new Set(['node_modules', '.git', '.nuxt', '.output', '.build', 'coverage', 'test-results'])
async function findPackage(name, from) {
  let directory = from
  while (true) {
    const candidate = resolve(directory, 'node_modules', name)
    try {
      return await realpath(candidate)
    }
    catch { /* Try the parent resolution scope. */ }
    const parent = dirname(directory)
    if (parent === directory)
      throw new Error(`Missing runtime dependency ${name} from ${from}`)
    directory = parent
  }
}
async function link(target, destination) {
  await mkdir(dirname(destination), { recursive: true })
  await symlink(relative(dirname(destination), target), destination, 'dir').catch(async (error) => {
    if (error.code !== 'EEXIST')
      throw error
  })
}
async function collect(source) {
  source = await realpath(source)
  if (seen.has(source))
    return seen.get(source)
  const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
  const id = `${pkg.name.replaceAll('/', '+')}@${pkg.version}-${createHash('sha256').update(source).digest('hex').slice(0, 8)}`
  const destination = resolve(runtime, 'node_modules/.store', id)
  seen.set(source, destination)
  await cp(source, destination, {
    recursive: true,
    filter: path => !relative(source, path).split('/').some(part => ignored.has(part)),
  })
  await link(destination, resolve(runtime, 'node_modules', pkg.name))
  const dependencies = { ...pkg.peerDependencies, ...pkg.dependencies, ...pkg.optionalDependencies }
  for (const name of Object.keys(dependencies)) {
    let dependency
    try {
      dependency = await findPackage(name, source)
    }
    catch (error) {
      if (pkg.optionalDependencies?.[name] || pkg.peerDependenciesMeta?.[name]?.optional)
        continue
      throw error
    }
    await link(await collect(dependency), resolve(destination, 'node_modules', name))
  }
  return destination
}
await collect(await findPackage('advjs', root))
await cp(resolve(root, 'dist'), resolve(runtime, 'dist'), { recursive: true })
// Every symlink must resolve inside the artifact; never ship workspace pointers.
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      const target = await realpath(path)
      if (relative(runtime, target).startsWith('..'))
        throw new Error(`External package link: ${path}`)
    }
    else if (entry.isDirectory()) {
      await verify(path)
    }
  }
}
await verify(runtime)
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
await mkdir(resolve(stage, 'app'), { recursive: true })
await cp(resolve(root, 'dist'), resolve(stage, 'app/dist'), { recursive: true })
await writeFile(resolve(stage, 'app/package.json'), JSON.stringify({ name: 'advjs-desktop', productName: 'ADV.JS Editor', version: pkg.version, description: pkg.description, author: pkg.author, license: pkg.license, main: 'dist/main.mjs', type: 'module', devDependencies: { electron: '44.4.5' }, config: { forge: resolve(root, 'forge.config.cjs') } }, null, 2))
process.stdout.write(`Staged ${seen.size} runtime packages;
 all package links are internal.\n`)
