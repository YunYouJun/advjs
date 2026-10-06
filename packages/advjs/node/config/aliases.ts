import { fileURLToPath } from 'node:url'

/** Resolve the bundled config helper when a copied project has no node_modules. */
export function bundledConfigAliases() {
  return { advjs: fileURLToPath(import.meta.resolve('advjs')) }
}
