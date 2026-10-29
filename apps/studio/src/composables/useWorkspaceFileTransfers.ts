import type { AGUIFileTransferRequest, AGUIFileTransferResult } from '@advjs/gui'
import type { StudioFileTransfer } from '../utils/projectFileTransfer'
import type { WorkspaceTextScope } from './useWorkspaceTextEditor'
import { transferStudioProjectFiles } from '../utils/projectFileTransfer'

/** Bind generic explorer transfers to one native project and its shared write queue. */
export function useWorkspaceFileTransfers(options: {
  getScope: () => WorkspaceTextScope | null
  draftPaths: (scope: WorkspaceTextScope) => Promise<Set<string>>
  prepareRelocation: (scope: WorkspaceTextScope, transfers: readonly StudioFileTransfer[]) => Promise<{ commit: () => void, after?: () => Promise<void>, release: () => void }>
  onFailure: (error: unknown) => Promise<void>
}) {
  return async (request: AGUIFileTransferRequest): Promise<AGUIFileTransferResult> => {
    const scope = options.getScope()
    const handles = request.items.map(item => item.handle)
    const names = request.names ? [...request.names] : undefined
    const move = request.move
    const targetHandle = request.targetDir.handle
    let relocation: Awaited<ReturnType<typeof options.prepareRelocation>> | undefined
    let completed: readonly StudioFileTransfer[] = []
    try {
      if (!scope || !handles.length || handles.some(handle => !handle) || (names && names.length !== handles.length))
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
      const assertCurrent = () => {
        const now = options.getScope()
        if (!now || now.projectId !== scope.projectId || now.root !== scope.root || now.fs !== scope.fs)
          throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
      }
      await transferStudioProjectFiles(scope.fs, async () => {
        const target = await scope.root.resolve(targetHandle)
        if (!target)
          throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
        const sources: string[] = []
        for (const handle of handles) {
          const path = await scope.root.resolve(handle!)
          assertCurrent()
          if (!path?.length)
            throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
          sources.push(path.join('/'))
        }
        const reserved = await options.draftPaths(scope)
        const intents: StudioFileTransfer[] = []
        for (const [index, source] of sources.entries()) {
          if (!names && sources.some((other, j) => j !== index && (source.startsWith(`${other}/`) || (j < index && other === source))))
            continue
          const base = names?.[index] ?? source.split('/').at(-1)!
          if (!base || base.includes('/') || base.includes('\\'))
            throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
          const join = (name: string) => [...target, name].join('/')
          let destination = join(base)
          if (!names) {
            const kind = (await scope.fs.stat(source)).type
            const dot = kind === 'file' ? base.lastIndexOf('.') : -1
            const stem = dot > 0 ? base.slice(0, dot) : base
            const suffix = dot > 0 ? base.slice(dot) : ''
            let n = 0
            while (reserved.has(destination) || await scope.fs.exists(destination)) {
              assertCurrent()
              destination = join(`${stem} ${++n}${suffix}`)
            }
          }
          reserved.add(destination)
          intents.push({ source, target: destination, move })
        }
        assertCurrent()
        relocation = await options.prepareRelocation(scope, intents)
        return intents
      }, { assertCurrent, applied: (transfers) => {
        relocation?.commit()
        completed = transfers
      } })
      await relocation?.after?.()
      return { success: true, moves: completed.filter(transfer => transfer.move).map(({ source, target }) => ({ source, target })) }
    }
    catch (error) {
      await options.onFailure(error)
      return { success: false }
    }
    finally {
      relocation?.release()
    }
  }
}
