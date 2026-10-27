<script setup lang="ts">
import type { AdvAgentIntegrationStatus } from '@advjs/types'
import { Toast } from '@advjs/gui'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'

const { t } = useI18n()
const open = defineModel('open', {
  type: Boolean,
  default: false,
})
const projectStore = useProjectStore()
const status = ref<AdvAgentIntegrationStatus>()
const loading = ref(false)
const selectedSceneId = ref('')
const id = useId()

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
  if (projectStore.workspaceMode !== 'local')
    return
  loading.value = true
  try {
    status.value = await projectStore.loadLocalAgentStatus()
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
    <AGUIForm padded>
      <div v-if="projectStore.workspaceMode !== 'local'" class="text-xs text-$agui-c-warning-text p-2 rounded bg-$agui-c-warning-soft">
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
          <div v-if="status" class="text-sm flex flex-col gap-2">
            <div
              v-for="check in status.checks"
              :key="check.id"
              class="text-xs p-2 rounded bg-$agui-c-bg-soft flex gap-2 items-start"
            >
              <span :class="check.status === 'pass' ? 'text-$agui-c-success-text' : 'text-$agui-c-warning-text'">
                {{ check.status === 'pass' ? '✓' : '!' }}
              </span>
              <span>{{ check.message }}</span>
            </div>
            <code v-if="!status.ready" class="text-xs p-2 rounded bg-$agui-c-bg-soft select-all">{{ status.installCommand }}</code>
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

        <AGUIForm as="section" class="pt-2 border-t border-$agui-c-divider-light">
          <AGUIFormItem :for="`${id}-scene`" :label="t('menu.createScene')" label-align="top">
            <AGUISelect :id="`${id}-scene`" v-model="selectedSceneId" :label="t('menu.createScene')" :options="promptScenes.map(scene => ({ value: scene.id, label: scene.name || scene.id }))" :disabled="!promptScenes.length" />
          </AGUIFormItem>
          <AGUIFormItem :for="`${id}-prompt`" :label="t('codex.taskPrompt')" label-align="top">
            <AGUITextarea :id="`${id}-prompt`" :model-value="taskPrompt" readonly :rows="9" />
          </AGUIFormItem>
          <div class="flex gap-2">
            <AGUIButton size="mini" :disabled="!taskPrompt" @click="copyText(taskPrompt, t('codex.taskCopied'))">
              {{ t('codex.copyTask') }}
            </AGUIButton>
            <AGUIButton size="mini" @click="projectStore.refreshProject">
              {{ t('codex.refreshProject') }}
            </AGUIButton>
          </div>
          <p v-if="promptScenes.length === 0" class="text-xs text-$agui-c-text-2">
            {{ t('codex.noPromptScenes') }}
          </p>
        </AGUIForm>
      </template>
    </AGUIForm>
  </AGUIDialog>
</template>
