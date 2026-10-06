/** Finite editor actions sent by the trusted main process, never arbitrary code. */
export type DesktopCommand = 'save' | 'reconnect' | 'workspace' | 'characters' | 'preferences' | 'project-settings' | 'about' | 'codex-workflow' | 'extensions' | 'reset-layout' | 'preview' | 'stop-preview' | 'export-directory' | 'export-zip'
