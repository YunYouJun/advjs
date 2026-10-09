import type { JsonObject, JsonValue } from '@advjs/types'
import type { EditorProjectModel } from '../adapters/browser/project'
import type { ProjectFileChange } from '../workspaces/project'
import { applyProjectPatches } from '@advjs/core'
import { projectNameError } from './project-creation'

export type ContentCreationKind = 'world' | 'scene' | 'chapter'

export interface ContentCreationInput {
  kind: ContentCreationKind
  id: string
  title: string
  locale: string
}

const RESERVED_IDS = new Set(Object.getOwnPropertyNames(Object.prototype).map(key => key.toLowerCase()))

export function contentCreationIdError(id: string): 'empty' | 'invalid' | 'reserved' | 'long' | undefined {
  if (!id.trim())
    return 'empty'
  if (id.length > 80)
    return 'long'
  if (!/^[a-z0-9][\w.-]*$/iu.test(id) || id.endsWith('.'))
    return 'invalid'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(id) || /^readme/iu.test(id) || RESERVED_IDS.has(id.toLowerCase()))
    return 'reserved'
}

export const contentCreationTitleError = projectNameError

function record(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function pathKey(path: string) {
  return path.replaceAll('\\', '/').split('/').filter(segment => segment && segment !== '.').join('/').normalize('NFC').toLowerCase()
}

function projectPath(path: string): string | undefined {
  const slashPath = path.replaceAll('\\', '/')
  if (!slashPath || slashPath.startsWith('/') || /^[a-z]:/iu.test(slashPath) || /[<>:"|?*]/u.test(slashPath) || [...slashPath].some(character => character.codePointAt(0)! < 32))
    return
  const segments = slashPath.split('/').filter(segment => segment && segment !== '.')
  if (!segments.length || segments.some(segment => segment === '..' || /[. ]$/u.test(segment) || ['.git', 'node_modules'].includes(segment.toLowerCase())))
    return
  return segments.join('/')
}

function markdownText(text: string) {
  return text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/gu, '\\$&')
}

function yamlText(text: string) {
  // The scene parser finds the closing --- delimiter before parsing YAML.
  return JSON.stringify(text).replaceAll('-', '\\u002d')
}

function template(kind: ContentCreationKind, id: string, title: string, english: boolean) {
  const heading = `# ${markdownText(title)}\n`
  if (kind === 'chapter')
    return `${heading}\n> ${english ? 'Write the story here.' : '从这里写下故事。'}\n`
  if (kind === 'scene') {
    return `---\nid: ${yamlText(id)}\nname: ${yamlText(title)}\ntype: image\n---\n\n${heading}\n${english ? 'Describe this scene and its atmosphere.' : '描述场景的环境与氛围。'}\n`
  }
  return `${heading}\n## ${english ? 'Setting' : '世界设定'}\n\n${english ? 'Describe the world, its rules and background.' : '描述故事世界的背景与规则。'}\n`
}

/** Plan source changes only; the workspace enforces every expected value on commit. */
export function contentCreationPlan(project: EditorProjectModel, input: ContentCreationInput): { path: string, changes: ProjectFileChange[] } {
  const english = !input.locale.toLowerCase().startsWith('zh')
  function fail(chinese: string, englishMessage: string): never {
    throw new Error(english ? englishMessage : chinese)
  }
  function parseConfig(path: string) {
    const source = project.files[path]
    if (source === undefined)
      fail(`找不到项目配置文件：${path}`, `Project configuration is missing: ${path}`)
    try {
      const value: unknown = JSON.parse(source)
      if (record(value))
        return value
    }
    catch {}
    fail(`项目配置必须是有效的 JSON 对象：${path}`, `Project configuration must be a valid JSON object: ${path}`)
  }

  const compilation = project.compilation
  if (project.mode !== 'standard-markdown' || compilation.project.format !== 'adv-md')
    fail('创建内容仅支持标准 Markdown 项目。', 'Content creation requires a standard Markdown project.')
  const configPath = compilation.sourceMap.config
  if (!configPath || !projectPath(configPath))
    fail('缺少有效的标准项目配置，请先修复项目。', 'The standard project configuration is missing or invalid. Repair the project first.')
  const config = parseConfig(configPath)
  if (config.format !== undefined && config.format !== 'adv-md' && config.format !== 'fountain')
    fail('创建内容仅支持标准 Markdown 项目。', 'Content creation requires a standard Markdown project.')
  if (config.root !== undefined && (typeof config.root !== 'string' || !projectPath(config.root)))
    fail('项目内容目录无效，请先修复 root 配置。', 'The project content directory is invalid. Repair the root configuration first.')
  const root = projectPath(compilation.project.root)
  if (!root || (config.root !== undefined && projectPath(config.root as string) !== root))
    fail('项目内容目录与编译结果不一致，请重新加载项目。', 'The content directory does not match the compiled project. Reload the project.')

  const gamePath = compilation.sourceMap.gameConfig
  if (gamePath && !projectPath(gamePath))
    fail('游戏配置路径无效。', 'The game configuration path is invalid.')
  const game = gamePath ? parseConfig(gamePath) : {}
  const paths = [...new Set([...Object.keys(project.files), ...project.filePaths ?? []])]
  const existingPath = (path: string) => {
    const key = pathKey(path)
    return paths.find(existing => pathKey(existing) === key)
  }

  const path = input.kind === 'world'
    ? `${root}/world.md`
    : `${root}/${input.kind === 'chapter' ? 'chapters' : 'scenes'}/${input.id}${input.kind === 'chapter' ? '.adv.md' : '.md'}`
  if (input.kind === 'world') {
    const existing = existingPath(path)
    if (existing)
      return { path: existing, changes: [] }
  }
  else {
    const issue = contentCreationIdError(input.id)
    if (issue)
      fail('标识必须是最多 80 字符的字母数字、点、下划线或连字符，且不能使用保留名称。', 'The ID must start with a letter or number, use at most 80 letters, numbers, dots, underscores or hyphens, and avoid reserved names.')
    const existing = existingPath(path)
    if (existing)
      fail(`文件已存在：${existing}`, `The file already exists: ${existing}`)
    const ids = input.kind === 'scene'
      ? [...compilation.project.scenes.map(scene => scene.id), ...Object.keys(compilation.sourceMap.scenes)]
      : [...compilation.project.chapters.map(chapter => chapter.id), ...Object.keys(compilation.sourceMap.chapters)]
    if (input.kind === 'chapter') {
      const prefix = pathKey(`${root}/chapters/`)
      for (const existing of paths) {
        const normalized = pathKey(existing)
        if (!normalized.startsWith(`${prefix}/`) || !normalized.endsWith('.adv.md'))
          continue
        const relative = normalized.slice(prefix.length + 1).split('/')
        ids.push(relative.length > 1 ? relative[0] : relative[0].slice(0, -'.adv.md'.length))
      }
    }
    if (ids.some(id => id.toLowerCase() === input.id.toLowerCase()))
      fail(`标识已存在：${input.id}`, `The ID already exists: ${input.id}`)
  }
  if (contentCreationTitleError(input.title))
    fail('标题不能为空，不能含控制字符，且最多 120 字符。', 'The title is required, must not contain control characters, and may have at most 120 characters.')
  const title = input.title.trim()
  const changes: ProjectFileChange[] = [{ path, expected: null, content: template(input.kind, input.id, title, english) }]
  if (input.kind !== 'chapter')
    return { path, changes }

  const updates: Record<string, JsonValue> = {}
  const discoveredChapters = compilation.project.chapters.map(chapter => ({
    id: chapter.id,
    ...(chapter.title ? { title: chapter.title } : {}),
    sources: chapter.sources,
  }))
  const appendedChapter = { id: input.id, title, sources: [`chapters/${input.id}.adv.md`] }
  const hasInferredIds = compilation.project.chapters.some((chapter) => {
    const relative = chapter.sources[0]?.slice(`${root}/chapters/`.length).split('/')
    const rawId = relative && (relative.length > 1 ? relative[0] : relative[0].slice(0, -'.adv.md'.length))
    return rawId !== chapter.id
  })
  if (game.chapters !== undefined) {
    if (!Array.isArray(game.chapters) || !game.chapters.every(record))
      fail('章节配置必须是对象数组，请先修复游戏配置。', 'The chapter configuration must be an array of objects. Repair the game configuration first.')
    // An empty configured list currently means automatic discovery; retain it.
    const chapters = game.chapters.length
      ? game.chapters
      : discoveredChapters
    updates.chapters = [...chapters, appendedChapter]
  }
  else if (hasInferredIds) {
    // Non-runtime filenames receive chapter-N IDs based on discovery order.
    // Freeze that mapping before adding a file can renumber existing targets.
    updates.chapters = [...discoveredChapters, appendedChapter]
  }

  const currentEntry = compilation.project.entryChapterId
  if (currentEntry && game.entryChapterId === undefined && config.entryChapterId === undefined) {
    const firstPath = compilation.project.chapters[0]?.sources[0]
    if (updates.chapters || (firstPath && path < firstPath))
      updates.entryChapterId = currentEntry
  }
  if (!Object.keys(updates).length)
    return { path, changes }

  const target = gamePath ?? `${root}/settings/game.json`
  // Node loaders may expose evaluated module configs as synthetic JSON. Never
  // write to those virtual files or shadow an executable authored config.
  if (gamePath && (project.virtualFiles?.includes(gamePath) || (project.filePaths && !project.filePaths.includes(gamePath))))
    fail('此游戏配置来自可执行配置，无法自动修改。请改用项目内的 JSON 游戏配置。', 'This game configuration comes from executable configuration and cannot be edited automatically. Use a JSON game configuration inside the project.')
  if (!gamePath && existingPath(target))
    fail(`游戏配置文件已存在，无法安全创建：${target}`, `The game configuration file already exists and cannot be created safely: ${target}`)
  let content = gamePath ? project.files[gamePath] : '{}\n'
  for (const [key, value] of Object.entries(updates)) {
    content = applyProjectPatches({ 'game.config.json': content }, [{ kind: 'json-set', path: 'game.config.json', key, value }]).files['game.config.json']
  }
  changes.push({ path: target, expected: gamePath ? project.files[gamePath] : null, content })
  return { path, changes }
}
