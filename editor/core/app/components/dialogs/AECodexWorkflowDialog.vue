<script setup lang="ts">
import type { AdvAgentIntegrationStatus } from '@advjs/types'
import { Toast } from '@advjs/gui'

const { t } = useI18n()
const open = defineModel('open', {
  type: Boolean,
  default: false,
})
const projectStore = useProjectStore()
const status = ref<AdvAgentIntegrationStatus>()
const loading = ref(false)
const selectedSceneId = ref('')

const promptScenes = computed(() => projectStore.scenes.filter(scene => scene.imagePrompt?.trim()))
const selectedScene = computed(() => promptScenes.value.find(scene => scene.id === selectedSceneId.value))
const taskPrompt = computed(() => {
  const scene = selectedScene.value
  if (!scene)
    return ''
  return [
    'Use $adv-art for this ADV.JS project.',
    `Create a provider-neutral background generation task for scene "${scene.id}" from its existing imagePrompt:`,
    scene.imagePrompt,
    '',
    'Use the ADV.JS asset MCP workflow to plan and ingest candidates.',
    'Show me the exact candidate before acceptance. Do not register or replace an asset until I explicitly approve that candidate.',
    'After acceptance, run adv check and refresh the Editor project.',
  ].join('\n')
})

watch(promptScenes, (scenes) => {
  if (!scenes.some(scene => scene.id === selectedSceneId.value))
    selectedSceneId.value = scenes[0]?.id ?? ''
}, { immediate: true })

async function refreshStatus() {
  const adapter = projectStore.localAdapter
  if (!adapter)
    return
  loading.value = true
  try {
    status.value = await adapter.loadCodexStatus()
  }
  catch (error) {
    Toast({
      title: t('codex.statusError'),
      description: error instanceof Error ? error.message : String(error),
      type: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

async function copyText(value: string, description: string) {
  await navigator.clipboard.writeText(value)
  Toast({ title: t('codex.copied'), description, type: 'success' })
}

watch(open, (isOpen) => {
  if (isOpen && projectStore.workspaceMode === 'local')
    void refreshStatus()
}, { immediate: true })
</script>

<template>
  <AGUIDialog v-model:open="open" :title="t('codex.title')" content-class="w-lg h-auto">
    <div class="flex flex-col gap-4 p-4">
      <div v-if="projectStore.workspaceMode !== 'local'" class="rounded bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300">
        {{ t('codex.localOnly') }}
      </div>

      <template v-else>
        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">
              {{ t('codex.readiness') }}
            </h3>
            <AGUIButton size="mini" :disabled="loading" @click="refreshStatus">
              {{ t('codex.refresh') }}
            </AGUIButton>
          </div>
          <div v-if="status" class="flex flex-col gap-2 text-sm">
            <div
              v-for="check in status.checks"
              :key="check.id"
              class="flex items-start gap-2 rounded bg-black/5 p-2 dark:bg-white/5"
            >
              <span :class="check.status === 'pass' ? 'text-green-600' : 'text-orange-600'">
                {{ check.status === 'pass' ? '✓' : '!' }}
              </span>
              <span>{{ check.message }}</span>
            </div>
            <code v-if="!status.ready" class="select-all rounded bg-black/5 p-2 text-xs dark:bg-white/5">{{ status.installCommand }}</code>
            <div class="flex gap-2">
              <AGUIButton v-if="!status.ready" size="mini" @click="copyText(status.installCommand, t('codex.installCopied'))">
                {{ t('codex.copyInstall') }}
              </AGUIButton>
              <AGUIButton size="mini" @click="copyText(status.doctorCommand, t('codex.doctorCopied'))">
                {{ t('codex.copyDoctor') }}
              </AGUIButton>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 class="font-semibold">
            {{ t('codex.taskPrompt') }}
          </h3>
          <select v-model="selectedSceneId" class="border border-black/20 rounded bg-transparent p-2 text-sm dark:border-white/20">
            <option v-for="scene in promptScenes" :key="scene.id" :value="scene.id">
              {{ scene.name || scene.id }}
            </option>
          </select>
          <textarea
            :value="taskPrompt"
            readonly
            rows="9"
            class="resize-none border border-black/20 rounded bg-black/3 p-2 text-xs dark:border-white/20 dark:bg-white/3"
          />
          <div class="flex gap-2">
            <AGUIButton size="mini" :disabled="!taskPrompt" @click="copyText(taskPrompt, t('codex.taskCopied'))">
              {{ t('codex.copyTask') }}
            </AGUIButton>
            <AGUIButton size="mini" @click="projectStore.refreshProject">
              {{ t('codex.refreshProject') }}
            </AGUIButton>
          </div>
          <p v-if="promptScenes.length === 0" class="text-sm op-60">
            {{ t('codex.noPromptScenes') }}
          </p>
        </section>
      </template>
    </div>
  </AGUIDialog>
</template>
