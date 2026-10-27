<script setup lang="ts">
import { createMusicMetadata, parseMusicMetadata } from '@advjs/audio'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { computed, shallowRef, useId, watch } from 'vue'
import { useAudioStore } from '../../../stores/useAudioStore'
import { useProjectAssets } from '../../../stores/useProjectAssets'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'
import AEMusicCreativeBrief from './AEMusicCreativeBrief.vue'
import AEProjectAudioItem from './AEProjectAudioItem.vue'
import { audioKindOptions } from './audio-options'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const assets = useProjectAssets()
const audio = useAudioStore()
const project = useProjectStore()
const drafts = useProjectDrafts()
const id = useId()
const search = shallowRef('')
const kind = shallowRef('all')
const importKind = shallowRef('bgm')
const error = shallowRef('')
const pending = shallowRef(false)
const music = shallowRef(createMusicMetadata({ usage: 'background', source: { type: 'manual' } }))
const workspaceGeneration = shallowRef(0)
const briefRecovery = shallowRef('')
const briefKey = 'music:import-brief'
let restoringBrief = false
watch(() => project.workspace, () => {
  workspaceGeneration.value++
}, { flush: 'sync' })
watch(() => [project.workspace, drafts.projectId], () => {
  restoringBrief = true
  music.value = createMusicMetadata({ usage: 'background', source: { type: 'manual' } })
  const recovery = drafts.projectId && drafts.formDraft(briefKey)
  briefRecovery.value = ''
  if (recovery) {
    try {
      music.value = parseMusicMetadata(JSON.parse(recovery.content))
      briefRecovery.value = '已恢复此项目的本机创作方案草稿。'
    }
    catch { briefRecovery.value = '原有恢复副本仍保留，但内容未通过音乐规范；可先下载并检查。' }
  }
  restoringBrief = false
}, { immediate: true, flush: 'post' })
watch(() => JSON.stringify(music.value), (content) => {
  if (restoringBrief || !drafts.projectId)
    return
  try {
    parseMusicMetadata(JSON.parse(content))
    drafts.saveFormDraft(briefKey, { base: null, content })
    briefRecovery.value = '创作方案恢复副本保存在本机，按当前项目隔离；不会进入游戏包。'
  }
  catch { briefRecovery.value = '方案尚未通过校验；本机恢复副本保留上次有效版本。请先修正或下载再切换项目。' }
}, { flush: 'sync' })
const writable = computed(() => !project.isRestoringProject && audio.supportedRoot && Boolean(project.workspace?.writeFiles && project.workspace.importAsset))
const filtered = computed(() => assets.audio.filter(asset => (kind.value === 'all' || asset.kind === kind.value)
  && `${asset.id} ${asset.title ?? ''} ${asset.alt ?? ''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const visibleIds = computed(() => new Set(filtered.value.map(asset => asset.id)))
const filters = [{ value: 'all', label: '全部用途' }, ...audioKindOptions]

async function importAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || pending.value)
    return
  const workspace = project.workspace
  pending.value = true
  try {
    await assets.importFile(file, importKind.value, undefined, importKind.value === 'bgm' ? music.value : undefined)
    if (project.workspace === workspace)
      error.value = ''
  }
  catch (failure) {
    if (project.workspace === workspace)
      error.value = failure instanceof Error ? failure.message : String(failure)
  }
  finally {
    pending.value = false
    input.value = ''
  }
}
async function initialize() {
  pending.value = true
  error.value = ''
  try {
    await audio.initializeCatalog()
  }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  finally { pending.value = false }
}
</script>

<template>
  <section class="ae-audio-assets" aria-label="项目音频资源" :aria-busy="pending">
    <AGUIToolbar :items="[]" label="项目音频资源">
      <template #before-toolbar>
        <span>原生音频目录</span>
      </template>
      <template #after-toolbar>
        <span class="ae-resource-caption">{{ filtered.length }} / {{ assets.audio.length }}</span>
      </template>
    </AGUIToolbar>
    <AGUIForm class="ae-audio-fields" padded>
      <AGUIButton v-if="!assets.manifest" :disabled="!audio.supportedRoot || !project.workspace?.writeFiles" :loading="pending" data-testid="audio-initialize" @click="initialize">
        创建原生音频目录
      </AGUIButton>
      <AGUIProperty label="用途筛选">
        <AGUISelect v-model="kind" :options="filters" label="音频用途筛选" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-search`" label="搜索">
        <AGUIInput :id="`${id}-search`" v-model="search" placeholder="名称、资源 ID 或描述" />
      </AGUIProperty>
      <AGUIProperty label="导入用途">
        <AGUISelect v-model="importKind" :options="audioKindOptions" label="导入音频用途" :disabled="pending || !writable" />
      </AGUIProperty>
      <AEMusicCreativeBrief v-if="importKind === 'bgm'" v-model="music" :disabled="pending || !writable" />
      <p v-if="importKind === 'bgm' && briefRecovery" class="ae-resource-caption" role="status">
        {{ briefRecovery }}
      </p>
      <label class="ae-audio-import" :for="`${id}-import`">导入项目音频
        <input :id="`${id}-import`" type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.opus" :disabled="pending || !writable || !assets.manifest" @change="importAudio">
      </label>
      <p v-if="importKind === 'bgm'" class="ae-resource-caption">
        新导入音乐需试听、保存来源与许可，再明确批准后用于剧情。歌曲不会自动替换当前 BGM。
      </p>
      <p v-if="!writable" class="ae-resource-caption" role="status">
        当前工作区只读，仍可检查资源和试听。
      </p>
      <p v-if="error" class="ae-resource-error" role="alert">
        {{ error }}
      </p>
    </AGUIForm>
    <ul class="ae-resource-list">
      <AEProjectAudioItem v-for="asset in assets.audio" v-show="visibleIds.has(asset.id)" :key="`${workspaceGeneration}:${asset.id}`" :asset="asset" :visible="visible && visibleIds.has(asset.id)" />
    </ul>
    <p v-if="!filtered.length" class="ae-resource-empty" role="status">
      {{ assets.audio.length ? '没有匹配的音频。' : '导入后，音频与元数据会保存到当前项目。' }}
    </p>
  </section>
</template>

<style scoped>
.ae-audio-import {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
}
.ae-audio-import input {
  min-width: 0;
  max-width: 100%;
  font: inherit;
}
</style>
