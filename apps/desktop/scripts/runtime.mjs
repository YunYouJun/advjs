import { cp, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

const ignored = new Set(['node_modules', '.git', '.nuxt', '.output', '.build', 'coverage', 'test-results'])

export async function findPackage(name, from) {
  let directory = from
  while (true) {
    try {
      return await realpath(resolve(directory, 'node_modules', name))
    }
    catch (error) {
      if (error.code !== 'ENOENT')
        throw error
    }
    const parent = dirname(directory)
    if (parent === directory)
      throw new Error(`Missing runtime dependency ${name} from ${from}`)
    directory = parent
  }
}

export async function verifyRuntimeLinks(directory, runtime = directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      const target = relative(runtime, await realpath(path))
      if (target === '..' || target.startsWith(`..${sep}`) || isAbsolute(target))
        throw new Error(`External package link: ${path}`)
    }
    else if (entry.isDirectory()) {
      await verifyRuntimeLinks(path, runtime)
    }
  }
}

/**
 * Materialize an npm-style dependency tree. Real directories survive Windows
 * ZIP extraction and relocation without symlink privileges or absolute junctions.
 * Source realpaths retain pnpm peer variants, even for identical name/version pairs.
 */
export async function stageRuntime({ name, from, destination }) {
  const graph = new Map()
  const hoisted = new Map()
  async function inspect(name, source) {
    if (!hoisted.has(name))
      hoisted.set(name, source)
    if (graph.has(source))
      return
    const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
    const dependencies = new Map()
    graph.set(source, { dependencies })
    for (const dependency of Object.keys({ ...pkg.peerDependencies, ...pkg.dependencies, ...pkg.optionalDependencies })) {
      let resolved
      try {
        resolved = await findPackage(dependency, source)
      }
      catch (error) {
        if (pkg.optionalDependencies?.[dependency] || pkg.peerDependenciesMeta?.[dependency]?.optional)
          continue
        throw error
      }
      dependencies.set(dependency, resolved)
      await inspect(dependency, resolved)
    }
  }
  await inspect(name, await findPackage(name, from))

  let copies = 0
  async function materialize(source, target, ancestors, ancestry) {
    if (ancestry.includes(source))
      throw new Error(`Conflicting dependency cycle cannot be materialized without links: ${source}`)
    const local = new Map()
    // Reserve every sibling before descending so later dependencies cannot
    // shadow a version that an earlier child's imports expected to inherit.
    for (const [dependency, resolved] of graph.get(source).dependencies) {
      const inherited = ancestors.find(scope => scope.has(dependency))?.get(dependency)
      if (inherited !== resolved)
        local.set(dependency, resolved)
    }
    await cp(source, target, {
      recursive: true,
      dereference: true,
      filter: path => !relative(source, path).split(sep).some(part => ignored.has(part)),
    })
    copies++
    for (const [dependency, resolved] of local)
      await materialize(resolved, resolve(target, 'node_modules', dependency), [local, ...ancestors], [...ancestry, source])
  }
  await mkdir(resolve(destination, 'node_modules'), { recursive: true })
  for (const [dependency, source] of hoisted)
    await materialize(source, resolve(destination, 'node_modules', dependency), [hoisted], [])
  await verifyRuntimeLinks(destination)
  return { packages: graph.size, copies }
}
