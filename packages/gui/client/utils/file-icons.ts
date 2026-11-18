/** Material Icon Theme artwork is rendered in color, never as a CSS mask. */
const directoryIcons = new Map([
  ['adv', 'folder-content'],
  ['assets', 'folder-resource'],
  ['media', 'folder-resource'],
  ['public', 'folder-public'],
  ['chapters', 'folder-markdown'],
  ['characters', 'folder-class'],
  ['scenes', 'folder-environment'],
  ['images', 'folder-images'],
  ['backgrounds', 'folder-images'],
  ['portraits', 'folder-images'],
  ['avatars', 'folder-images'],
  ['textures', 'folder-images'],
  ['sprites', 'folder-images'],
  ['audio', 'folder-audio'],
  ['music', 'folder-audio'],
  ['sounds', 'folder-audio'],
  ['voice', 'folder-audio'],
  ['voices', 'folder-audio'],
  ['video', 'folder-video'],
  ['videos', 'folder-video'],
  ['models', 'folder-container'],
  ['settings', 'folder-config'],
  ['config', 'folder-config'],
  ['samples', 'folder-examples'],
])

const fileIcons = new Map([
  ['adv', 'markdown'],
  ['md', 'markdown'],
  ['json', 'json'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['ini', 'settings'],
  ['avif', 'image'],
  ['bmp', 'image'],
  ['gif', 'image'],
  ['jpeg', 'image'],
  ['jpg', 'image'],
  ['png', 'image'],
  ['svg', 'svg'],
  ['webp', 'image'],
  ['aac', 'audio'],
  ['flac', 'audio'],
  ['m4a', 'audio'],
  ['mp3', 'audio'],
  ['ogg', 'audio'],
  ['opus', 'audio'],
  ['wav', 'audio'],
  ['mp4', 'video'],
  ['ogv', 'video'],
  ['webm', 'video'],
  ['mov', 'video'],
  ['glb', '3d'],
  ['gltf', '3d'],
  ['vrm', '3d'],
  ['fbx', '3d'],
  ['obj', '3d'],
  ['vue', 'vue'],
  ['js', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['jsx', 'react'],
  ['ts', 'typescript'],
  ['mts', 'typescript'],
  ['cts', 'typescript'],
  ['tsx', 'react-ts'],
  ['css', 'css'],
  ['scss', 'sass'],
  ['html', 'html'],
  ['xml', 'xml'],
  ['csv', 'table'],
  ['txt', 'document'],
  ['pdf', 'pdf'],
  ['zip', 'zip'],
])

function iconClass(name: string) {
  return `i-material-icon-theme-${name}?bg`
}

export function materialDirectoryIcon(path: string, expanded = false): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  const icon = directoryIcons.get(name) ?? 'folder-other'
  return iconClass(expanded ? `${icon}-open` : icon)
}

export function materialFileIcon(path: string): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  if (name.endsWith('.character.md'))
    return iconClass('authors')
  if (/^readme(?:\.|$)/u.test(name))
    return iconClass('readme')
  if (/^licen[cs]e(?:\.|$)/u.test(name))
    return iconClass('license')
  return iconClass(fileIcons.get(name.split('.').at(-1) ?? '') ?? 'document')
}

/** Keep runtime path mappings and UnoCSS generation in sync. */
export const materialFileIconSafelist: string[] = [...new Set([
  'folder-other',
  'folder-other-open',
  ...[...directoryIcons.values()].flatMap(icon => [icon, `${icon}-open`]),
  ...fileIcons.values(),
  'authors',
  'readme',
  'license',
])].map(iconClass)
