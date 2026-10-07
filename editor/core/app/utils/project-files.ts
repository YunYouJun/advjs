import type { TreeNode } from '@advjs/gui'

export type ProjectFileKind = 'text' | 'image' | 'audio' | 'video' | 'model' | 'unsupported'

const directoryIcons = new Map([
  ['assets', 'i-ri-folders-line'],
  ['chapters', 'i-ri-book-open-line'],
  ['characters', 'i-ri-folder-user-line'],
  ['scenes', 'i-ri-landscape-line'],
  ['images', 'i-ri-folder-image-line'],
  ['backgrounds', 'i-ri-folder-image-line'],
  ['portraits', 'i-ri-folder-user-line'],
  ['avatars', 'i-ri-folder-user-line'],
  ['textures', 'i-ri-folder-image-line'],
  ['sprites', 'i-ri-folder-image-line'],
  ['audio', 'i-ri-folder-music-line'],
  ['music', 'i-ri-folder-music-line'],
  ['sounds', 'i-ri-folder-music-line'],
  ['voices', 'i-ri-folder-music-line'],
  ['video', 'i-ri-folder-video-line'],
  ['videos', 'i-ri-folder-video-line'],
  ['models', 'i-ri-box-3-line'],
])

export function projectDirectoryIcon(path: string): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  return directoryIcons.get(name) ?? 'i-ri-folder-line'
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
        node = { id: prefix, name, kind: directory ? 'directory' : 'file', icon: directory ? projectDirectoryIcon(prefix) : path.endsWith('.character.md') ? 'i-ri-user-line' : 'i-ri-file-text-line' }
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
