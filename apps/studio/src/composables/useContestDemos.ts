/**
 * Contest demo installer — hydrates a bundled demo into a fresh MemoryFs-backed
 * project and switches Studio to it. Designed for the "load contest demo"
 * action card in WorkspacePage.
 *
 * Why MemoryFs (not BrowserFs)?
 * - Zero File System Access prompts → no "grant permission" dialog on stage
 * - Works in Safari / Firefox / mobile browsers that lack the FS Access API
 * - IndexedDB-backed → survives reload, behaves like a regular project
 *
 * Flow:
 *   loadContestDemoFiles(slug)        // bundled assets
 *     ↓
 *   new MemoryFsAdapter(projectId)    // init() to load any prior state
 *     ↓
 *   writeFile(...) for each demo file
 *     ↓
 *   adapter.persist()                 // flush debounced writes immediately
 *     ↓
 *   studioStore.switchProject(...)    // surface in project list + activate
 *     ↓
 *   useProjectContent().reload()      // re-scan adv/ so dashboard updates
 */

import type { ContestDemoMeta } from '../utils/contestDemos'
import { useStudioStore } from '../stores/useStudioStore'
import { CONTEST_DEMOS, contestDemoProjectId, loadContestDemoFiles } from '../utils/contestDemos'
import { MemoryFsAdapter } from '../utils/fs/MemoryFsAdapter'

import { useProjectContent } from './useProjectContent'

export interface InstallResult {
  /** Whether files were freshly written (true) or the demo was already present (false). */
  installed: boolean
  /** The studioStore project record now active. */
  projectId: string
  /** Number of files written. Zero if `installed === false`. */
  fileCount: number
}

export function useContestDemos() {
  const studioStore = useStudioStore()

  /**
   * List of demos available to surface in UI. Re-exposed so the WorkspacePage
   * doesn't have to import from utils/.
   */
  const demos: ContestDemoMeta[] = CONTEST_DEMOS

  /**
   * Install (or re-activate) a contest demo project.
   *
   * Behavior:
   * - If the demo's projectId is already in the project list AND has files in
   *   MemoryFs → just switch to it (idempotent, no re-write).
   * - Otherwise → write all bundled files into a fresh MemoryFs and add the
   *   project to studioStore.
   *
   * `force: true` re-writes even if files exist (use for "reset demo" affordance).
   */
  async function installDemo(
    meta: ContestDemoMeta,
    options: { force?: boolean } = {},
  ): Promise<InstallResult> {
    const projectId = contestDemoProjectId(meta.slug)
    const adapter = new MemoryFsAdapter(projectId)
    await adapter.init()

    // Cheap probe: world.md is the canonical "is this a real ADV project" marker
    // and every demo includes it. If present, the demo is already installed.
    const alreadyInstalled = await adapter.exists('adv/world.md')

    let written = 0
    if (!alreadyInstalled || options.force) {
      const files = loadContestDemoFiles(meta.slug)
      if (files.length === 0)
        throw new Error(`[contestDemo] no bundled files for slug "${meta.slug}"`)

      // bulkLoad is the same pattern handleQuickStart uses — one synchronous
      // pass through the file list, then one async persist. Avoids N debounce
      // timers stacking up.
      adapter.bulkLoad(files)
      written = files.length
      await adapter.persist()
    }

    // Activate the project in studioStore. switchProject calls addProject
    // internally if the projectId isn't yet in the list (de-duplicates by id).
    await studioStore.switchProject({
      projectId,
      name: meta.name,
      description: meta.description,
      source: 'local',
      lastOpened: Date.now(),
    })
    // Reload project content so the Workspace dashboard immediately reflects
    // the freshly-installed adv/ contents.
    await useProjectContent().reload()

    return {
      installed: !alreadyInstalled || !!options.force,
      projectId,
      fileCount: written,
    }
  }

  return {
    demos,
    installDemo,
  }
}
