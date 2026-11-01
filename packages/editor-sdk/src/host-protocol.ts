/** Version 1 of the trusted local project-host protocol. Credentials stay in Node. */
export const EDITOR_PROJECT_HOST_VERSION = 1 as const
export const EDITOR_PROJECT_HOST_PATH = '/__advjs/workspaces'
export interface EditorRepository { root: string, name: string }
export interface EditorProjectHostInfo { apiVersion?: 1, id: string, title: string, defaultRoot: string }
export interface EditorRepositoryBinding extends EditorRepository { id: string, apiToken: string }
export interface EditorPluginPackageManifest {
  apiVersion: 1
  id: string
  entry: string
  styles?: string[]
  /** Informational Node export; never imported from a selected project. */
  host?: string
}
