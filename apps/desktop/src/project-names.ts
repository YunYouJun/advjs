export interface ProjectCreationInput { name: string, folderName: string }
export interface ProjectCreationDefaults { directory: string, folderName: string }
export interface ProjectCreationResult { created: boolean, error?: string }

export function projectFolderError(name: string): 'empty' | 'invalid' | 'reserved' | 'long' | undefined {
  if (!name.trim())
    return 'empty'
  if (name.length > 80)
    return 'long'
  if (name !== name.trim() || /[<>:"/\\|?*]/u.test(name) || [...name].some(character => character.codePointAt(0)! < 32) || /[. ]$/u.test(name) || name === '.' || name === '..')
    return 'invalid'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name))
    return 'reserved'
}

export function projectNameError(name: string): 'empty' | 'invalid' | 'long' | undefined {
  if (!name.trim())
    return 'empty'
  if (name.trim().length > 120)
    return 'long'
  if ([...name].some(character => character.codePointAt(0)! < 32))
    return 'invalid'
}
