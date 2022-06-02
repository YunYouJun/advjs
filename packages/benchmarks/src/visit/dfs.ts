import consola from 'consola'

interface Tree {
  type: string
  children?: Tree[]
}

export function dfs(tree: Tree, callback: Function) {
  callback(tree)
  try {
    if (tree.children)
      tree.children.map(child => dfs(child, (node: Tree) => callback(node)))
  }
  catch (e) {
    consola.error(e)
  }
  return null
}
