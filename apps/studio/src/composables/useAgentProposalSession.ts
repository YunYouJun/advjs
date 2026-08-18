import { createStudioAgentProjectWorkspace } from '@advjs/agent'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, watch } from 'vue'
import { useAgentProposalStore } from '../stores/useAgentProposalStore'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useProjectContent } from './useProjectContent'

/** Connects completed managed task candidates to the active Studio workspace. */
export function useAgentProposalSession(): void {
  const managedStore = useManagedAgentStore()
  const proposalStore = useAgentProposalStore()
  const studioStore = useStudioStore()
  const projectContent = useProjectContent()
  const { task } = storeToRefs(managedStore)
  let generation = 0

  watch(
    () => studioStore.currentProject?.projectId,
    async (projectId) => {
      generation += 1
      const currentGeneration = generation
      proposalStore.disconnect()
      if (!projectId)
        return
      await projectContent.whenReady()
      if (currentGeneration !== generation)
        return
      const fs = projectContent.getFs()
      if (!fs)
        return
      proposalStore.configure(
        createStudioAgentProjectWorkspace(fs, projectId),
        { onWorkspaceChanged: projectContent.reload },
      )
      const current = task.value
      if (current?.proposal && current.usage) {
        await proposalStore.offer({
          taskId: current.taskId,
          projectId,
          proposal: current.proposal,
          usage: current.usage,
        })
      }
    },
    { immediate: true },
  )

  watch(task, async (current) => {
    const projectId = studioStore.currentProject?.projectId
    if (!projectId || !current?.proposal || !current.usage)
      return
    await proposalStore.offer({
      taskId: current.taskId,
      projectId,
      proposal: current.proposal,
      usage: current.usage,
    })
  }, { deep: false })

  onBeforeUnmount(() => {
    generation += 1
    proposalStore.disconnect()
  })
}
