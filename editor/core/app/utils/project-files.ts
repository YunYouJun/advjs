import type { TreeNode } from '@advjs/gui'
import type { MonacoEditorLanguage } from '../stores/useMonacoStore'
import { materialDirectoryIcon, materialFileIcon } from '@advjs/gui/client/utils/file-icons.ts'

export type ProjectFileKind = 'text' | 'image' | 'audio' | 'video' | 'model' | 'unsupported'

export function projectDirectoryIcon(path: string, expanded = false): string {
  return materialDirectoryIcon(path, expanded)
}

export function projectFileKind(path: string): ProjectFileKind {
  if (/\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/iu.test(path))
    return 'image'
  if (/\.(?:aac|flac|m4a|mp3|ogg|opus|wav)$/iu.test(path))
    return 'audio'
  if (/\.(?:mp4|ogv|webm|mov)$/iu.test(path))
    return 'video'
  if (/\.(?:glb|gltf|vrm|fbx|obj)$/iu.test(path))
    return 'model'
  if (/(?:\.(?:adv|css|csv|html|ini|js|json|jsx|md|mjs|scss|ts|tsx|txt|vue|xml|yaml|yml)|(?:^|\/)(?:LICENSE|README))$/iu.test(path))
    return 'text'
  return 'unsupported'
}

export function projectFileAppearance(path: string): { icon: string } {
  return { icon: materialFileIcon(path) }
}

const monacoLanguages: Record<string, MonacoEditorLanguage> = {
  ts: 'typescript',
  js: 'javascript',
  html: 'html',
  vue: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
  md: 'markdown',
}

/** Monaco language for a text file; `.adv.md` scripts use the ADV grammar. */
export function projectFileLanguage(path: string): MonacoEditorLanguage {
  if (/\.adv\.md$/iu.test(path))
    return 'adv'
  return monacoLanguages[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext'
}

export function projectFileTree(paths: readonly string[], expanded: ReadonlySet<string>, query = ''): TreeNode[] {
  const roots: TreeNode[] = []
  const directories = new Map<string, TreeNode>()
  const filter = query.trim().toLocaleLowerCase()
  for (const path of paths) {
    if (filter && !path.toLocaleLowerCase().includes(filter))
      continue
    const segments = path.split('/')
    let children = roots
    let prefix = ''
    for (const [index, name] of segments.entries()) {
      prefix = prefix ? `${prefix}/${name}` : name
      const directory = index < segments.length - 1
      let node = directory ? directories.get(prefix) : undefined
      if (!node) {
        node = {
          id: prefix,
          name,
          kind: directory ? 'directory' : 'file',
          ...directory
            ? { icon: projectDirectoryIcon(prefix), expandedIcon: projectDirectoryIcon(prefix, true) }
            : projectFileAppearance(path),
        }
        if (directory) {
          node.children = []
          node.expanded = !!filter || expanded.has(prefix)
          directories.set(prefix, node)
        }
        children.push(node)
      }
      children = node.children ?? []
    }
  }
  function sort(nodes: TreeNode[]) {
    nodes.sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name!.localeCompare(b.name!))
    for (const node of nodes) {
      if (node.children)
        sort(node.children)
    }
  }
  sort(roots)
  return roots
}
/** Map game public URLs and project-relative references to workspace files. */
export function projectAssetPath(path: string, filePaths: readonly string[]) {
  const normalized = path.replace(/^\.\//u, '').replace(/^\//u, '')
  const candidates = path.startsWith('/')
    ? [`public/${normalized}`, normalized]
    : [normalized, `public/${normalized}`]
  return candidates.find(candidate => filePaths.includes(candidate)) ?? normalized
}
