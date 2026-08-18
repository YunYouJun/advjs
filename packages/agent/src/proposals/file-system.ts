export interface AgentProjectFileEntry {
  path: string
  content: string
}

export interface AgentProjectFileSystem {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  collectAllFiles: () => Promise<readonly AgentProjectFileEntry[]>
}
