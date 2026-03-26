import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import { acceptHMRUpdate, defineStore } from 'pinia'

export interface CharacterFileEntry {
  character: AdvCharacter
  relativePath: string
  fileHandle: FileSystemFileHandle
}

export const useCharacterStore = defineStore('editor:character', () => {
  /**
   * 被选择的角色
   */
  const selectedCharacter = ref<AdvCharacter>()

  /**
   * 选中角色对应的 fileHandle（用于写回）
   */
  const selectedCharacterHandle = shallowRef<FileSystemFileHandle>()

  /**
   * 所有角色列表
   */
  const characters = ref<AdvCharacter[]>([])

  /**
   * 加载状态
   */
  const loading = ref(false)

  /**
   * 搜索关键词
   */
  const searchQuery = ref('')

  /**
   * 角色文件所在目录（本地路径，持久化到 localStorage）— 用于服务端 API
   */
  const charactersDir = useLocalStorage('advjs-characters-dir', '')

  /**
   * 浏览器端 File System Access API 的目录句柄
   */
  const dirHandle = shallowRef<FileSystemDirectoryHandle>()

  /**
   * 文件条目映射（角色ID → 文件信息）
   */
  const fileEntries = ref<Map<string, CharacterFileEntry>>(new Map())

  /**
   * 文件树结构（用于侧边栏显示）
   */
  const fileTree = ref<FileTreeNode[]>([])

  /**
   * 过滤后的角色列表
   */
  const filteredCharacters = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query)
      return characters.value

    return characters.value.filter((c) => {
      return c.name.toLowerCase().includes(query)
        || c.id.toLowerCase().includes(query)
        || c.personality?.toLowerCase().includes(query)
        || c.faction?.toLowerCase().includes(query)
        || c.tags?.some(t => t.toLowerCase().includes(query))
        || c.aliases?.some(a => a.toLowerCase().includes(query))
    })
  })

  /**
   * === 飞书 bitable 配置（保留用于可选同步）===
   */
  const feishuTableId = useLocalStorage('advjs-feishu-table-id', '')
  const feishuAppToken = useLocalStorage('advjs-feishu-app-token', '')

  // ========================
  // Server API methods (fallback)
  // ========================

  /**
   * 从本地 .character.md 文件读取角色列表（服务端 API）
   */
  async function fetchCharacters() {
    if (!charactersDir.value)
      return

    loading.value = true
    try {
      const { characters: result } = await $fetch<{ characters: AdvCharacter[] }>('/api/characters', {
        params: { dir: charactersDir.value },
      })
      characters.value = result
    }
    catch (e) {
      console.error('Failed to fetch characters:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 创建角色（写入 .character.md 文件）— 服务端 API
   */
  async function createCharacter(data: Partial<AdvCharacter>) {
    if (!data.id || !data.name)
      return

    // If we have a dirHandle, use browser API
    if (dirHandle.value) {
      await createCharacterToHandle(data)
      return
    }

    if (!charactersDir.value)
      return

    loading.value = true
    try {
      await $fetch('/api/characters', {
        method: 'POST',
        body: {
          dir: charactersDir.value,
          character: data,
        },
      })
      await fetchCharacters()
    }
    catch (e) {
      console.error('Failed to create character:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 更新角色（写回 .character.md 文件）
   */
  async function updateCharacter(character: AdvCharacter) {
    if (!character.id)
      return

    // If we have a file handle for this character, use browser API
    const entry = fileEntries.value.get(character.id)
    if (entry?.fileHandle) {
      await updateCharacterToHandle(character, entry.fileHandle)
      return
    }

    if (!charactersDir.value)
      return

    loading.value = true
    try {
      await $fetch('/api/characters', {
        method: 'PUT',
        body: {
          dir: charactersDir.value,
          character,
        },
      })
      await fetchCharacters()
    }
    catch (e) {
      console.error('Failed to update character:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 删除角色（删除 .character.md 文件）
   */
  async function deleteCharacter(character: AdvCharacter) {
    if (!charactersDir.value || !character.id)
      return

    loading.value = true
    try {
      await $fetch('/api/characters', {
        method: 'DELETE',
        params: {
          dir: charactersDir.value,
          id: character.id,
        },
      })
      characters.value = characters.value.filter(c => c.id !== character.id)
      if (selectedCharacter.value?.id === character.id)
        selectedCharacter.value = undefined
    }
    catch (e) {
      console.error('Failed to delete character:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 导出角色为 AI 友好格式
   */
  async function exportForAI(id: string): Promise<string | null> {
    if (!charactersDir.value || !id)
      return null

    try {
      const { markdown } = await $fetch<{ markdown: string }>('/api/characters/export', {
        params: {
          dir: charactersDir.value,
          id,
        },
      })
      return markdown
    }
    catch (e) {
      console.error('Failed to export character:', e)
      return null
    }
  }

  // ========================
  // Browser File System Access API methods
  // ========================

  /**
   * 打开本地目录（浏览器 File System Access API）
   */
  async function openDirectory() {
    try {
      dirHandle.value = await window.showDirectoryPicker()
      await fetchCharactersFromHandle()
    }
    catch (e) {
      // User cancelled
      console.error('Failed to open directory:', e)
    }
  }

  /**
   * 递归遍历目录读取 .character.md 文件
   */
  async function fetchCharactersFromHandle() {
    if (!dirHandle.value)
      return

    loading.value = true
    try {
      const result: AdvCharacter[] = []
      const entries = new Map<string, CharacterFileEntry>()
      const tree: FileTreeNode[] = []

      await traverseDirectory(dirHandle.value, '', result, entries, tree)

      characters.value = result
      fileEntries.value = entries
      fileTree.value = tree
    }
    catch (e) {
      console.error('Failed to fetch characters from handle:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 递归遍历目录
   */
  async function traverseDirectory(
    handle: FileSystemDirectoryHandle,
    basePath: string,
    result: AdvCharacter[],
    entries: Map<string, CharacterFileEntry>,
    treeNodes: FileTreeNode[],
  ) {
    const dirChildren: FileTreeNode[] = []

    for await (const entry of handle.values()) {
      if (entry.name.startsWith('.'))
        continue

      if (entry.kind === 'directory') {
        const subDir = entry as FileSystemDirectoryHandle
        const subPath = basePath ? `${basePath}/${entry.name}` : entry.name
        const dirNode: FileTreeNode = {
          name: entry.name,
          kind: 'directory',
          path: subPath,
          children: [],
          handle: subDir,
        }
        await traverseDirectory(subDir, subPath, result, entries, dirNode.children!)
        dirChildren.push(dirNode)
      }
      else if (entry.kind === 'file' && entry.name.endsWith('.character.md')) {
        const fileHandle = entry as FileSystemFileHandle
        const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
        try {
          const file = await fileHandle.getFile()
          const content = await file.text()
          const character = parseCharacterMd(content)
          result.push(character)
          entries.set(character.id, {
            character,
            relativePath: filePath,
            fileHandle,
          })
          dirChildren.push({
            name: entry.name,
            kind: 'file',
            path: filePath,
            characterId: character.id,
          })
        }
        catch (e) {
          console.warn(`Failed to parse ${filePath}:`, e)
        }
      }
    }

    // Sort: directories first, then files
    dirChildren.sort((a, b) => {
      if (a.kind !== b.kind)
        return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    treeNodes.push(...dirChildren)
  }

  /**
   * 创建角色到浏览器文件系统
   */
  async function createCharacterToHandle(data: Partial<AdvCharacter>, subDir?: string) {
    if (!dirHandle.value || !data.id || !data.name)
      return

    loading.value = true
    try {
      const character = {
        id: data.id,
        name: data.name,
        avatar: data.avatar,
        actor: data.actor,
        cv: data.cv,
        aliases: data.aliases,
        tags: data.tags,
        faction: data.faction,
        personality: data.personality,
        appearance: data.appearance,
        background: data.background,
        concept: data.concept,
        speechStyle: data.speechStyle,
      } as AdvCharacter

      const mdContent = stringifyCharacterMd(character)
      const fileName = `${data.id}.character.md`

      let targetDir = dirHandle.value
      if (subDir) {
        targetDir = await dirHandle.value.getDirectoryHandle(subDir, { create: true })
      }

      const fileHandle = await targetDir.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(mdContent)
      await writable.close()

      // Refresh
      await fetchCharactersFromHandle()
    }
    catch (e) {
      console.error('Failed to create character file:', e)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 更新角色到浏览器文件系统
   */
  async function updateCharacterToHandle(character: AdvCharacter, fileHandle: FileSystemFileHandle) {
    loading.value = true
    try {
      const mdContent = stringifyCharacterMd(character)
      const writable = await fileHandle.createWritable()
      await writable.write(mdContent)
      await writable.close()

      // Update local state
      const idx = characters.value.findIndex(c => c.id === character.id)
      if (idx >= 0) {
        characters.value[idx] = character
      }

      // Update entry
      const entry = fileEntries.value.get(character.id)
      if (entry) {
        entry.character = character
      }
    }
    catch (e) {
      console.error('Failed to update character file:', e)
    }
    finally {
      loading.value = false
    }
  }

  return {
    selectedCharacter,
    selectedCharacterHandle,
    characters,
    loading,
    searchQuery,
    filteredCharacters,
    charactersDir,

    // Browser File System Access API
    dirHandle,
    fileEntries,
    fileTree,
    openDirectory,
    fetchCharactersFromHandle,
    createCharacterToHandle,

    // 飞书（保留用于可选同步）
    feishuTableId,
    feishuAppToken,

    // 操作
    fetchCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    exportForAI,
  }
})

/**
 * 文件树节点类型
 */
export interface FileTreeNode {
  name: string
  kind: 'file' | 'directory'
  path: string
  children?: FileTreeNode[]
  characterId?: string
  handle?: FileSystemDirectoryHandle
}

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useCharacterStore, import.meta.hot))
