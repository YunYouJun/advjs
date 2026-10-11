<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import { useProjectAssets } from '../../../stores/useProjectAssets'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'
import { audioKindOptions } from './audio-options'

const props = withDefaults(defineProps<{ asset: AdvAssetEntry, visible?: boolean }>(), { visible: true })
const assets = useProjectAssets()
const project = useProjectStore()
const drafts = useProjectDrafts()
const title = shallowRef(props.asset.title ?? '')
const description = shallowRef(props.asset.alt ?? '')
const kind = shallowRef(props.asset.kind)
let expectedFiles = project.project!.files
const busy = shallowRef(false)
const writable = computed(() => project.project?.compilation.project.root === 'adv' && Boolean(project.workspace?.writeFiles))
const player = shallowRef<HTMLAudioElement>()
watch(() => props.visible, (visible) => {
  if (!visible)
    releasePreview()
})
const src = shallowRef('')
const error = shallowRef('')
const id = useId()
const dirty = computed(() => title.value !== (props.asset.title ?? '') || description.value !== (props.asset.alt ?? '') || kind.value !== props.asset.kind)
watch(dirty, dirty => drafts.register(id, { dirty, save }), { immediate: true })
watch(() => [props.asset.title ?? '', props.asset.alt ?? '', props.asset.kind], (next, previous) => {
  if (title.value === previous[0] && description.value === previous[1] && kind.value === previous[2]) {
    title.value = next[0]!
    description.value = next[1]!
    kind.value = next[2] as AdvAssetEntry['kind']
    expectedFiles = project.project!.files
  }
})
let generation = 0
function releasePreview() {
  generation++
  player.value?.pause()
  if (src.value.startsWith('blob:'))
    URL.revokeObjectURL(src.value)
  src.value = ''
}
watch(() => JSON.stringify([props.asset.path, props.asset.url, props.asset.variants, assets.manifest?.profiles, project.resourceRevision]), releasePreview)
async function preview() {
  releasePreview()
  const request = generation
  busy.value = true
  error.value = ''
  try {
    const media = await assets.media(props.asset)
    if (request !== generation) {
      if (media.src.startsWith('blob:'))
        URL.revokeObjectURL(media.src)
      return
    }
    src.value = media.src
  }
  catch (failure) {
    if (request === generation)
      error.value = `资源缺失：${String(failure)}`
  }
  finally { busy.value = false }
}
onBeforeUnmount(() => {
  releasePreview()
  drafts.remove(id)
})
async function save() {
  try {
    await assets.upsert({ ...props.asset, title: title.value, alt: description.value, kind: kind.value }, expectedFiles)
    expectedFiles = project.project!.files
    drafts.remove(id)
    error.value = ''
    return true
  }
  catch (failure) {
    error.value = String(failure)
    return false
  }
}
function reloadExternal() {
  title.value = props.asset.title ?? ''
  description.value = props.asset.alt ?? ''
  kind.value = props.asset.kind
  expectedFiles = project.project!.files
  error.value = ''
}
async function keepDraft() {
  expectedFiles = project.project!.files
  await save()
}
async function remove() {
  // eslint-disable-next-line no-alert
  if (!window.confirm('移除此音频引用？文件将保留，避免删除共享资源。'))
    return
  try {
    await assets.remove(props.asset)
  }
  catch (failure) {
    error.value = String(failure)
  }
}
</script>

<template>
  <li class="ae-resource-row ae-audio-asset" :data-asset-id="asset.id">
    <div class="ae-audio-heading">
      <div class="ae-resource-meta">
        <span class="ae-resource-name">{{ asset.title || asset.id }}</span><span class="ae-resource-caption"> · {{ asset.kind }}</span>
      </div>
      <AGUIButton :loading="busy" :disabled="!visible" :aria-label="`载入试听 ${asset.title || asset.id}`" data-testid="asset-preview" @click="preview">
        试听
      </AGUIButton>
    </div>
    <audio v-if="src" ref="player" :src="src" controls preload="none" :aria-label="`项目音频试听 ${asset.title || asset.id}`" class="ae-audio-player" @error="error = '无法播放资源，请检查文件或编码'" />
    <AGUIDetails :title="`属性 · ${asset.id}`">
      <AGUIProperty :for="`${id}-title`" label="名称">
        <AGUIInput :id="`${id}-title`" v-model="title" :disabled="!writable" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-description`" label="描述">
        <AGUIInput :id="`${id}-description`" v-model="description" :disabled="!writable" />
      </AGUIProperty>
      <AGUIProperty label="用途">
        <AGUISelect v-model="kind" :options="audioKindOptions" label="音频用途" :disabled="!writable" />
      </AGUIProperty>
      <p class="ae-resource-caption">
        {{ asset.path ?? asset.url ?? asset.objectKey }} · {{ asset.duration ? `${asset.duration} 秒` : '未记录时长' }}
      </p>
      <p v-if="asset.sha256" class="ae-resource-caption">
        SHA-256 · {{ asset.sha256 }}
      </p>
      <div class="ae-resource-actions">
        <AGUIButton :disabled="!dirty || !writable" @click="save">
          保存属性
        </AGUIButton>
        <AGUIButton theme="danger" variant="text" :disabled="!writable" @click="remove">
          移除引用
        </AGUIButton>
      </div>
      <div v-if="error" class="ae-resource-actions">
        <AGUIButton @click="reloadExternal">
          载入项目版本
        </AGUIButton><AGUIButton :disabled="!writable" @click="keepDraft">
          保留草稿并重试
        </AGUIButton>
      </div>
    </AGUIDetails>
    <p v-if="error" role="alert" class="ae-resource-error">
      {{ error }}
    </p>
  </li>
</template>

<style scoped>
.ae-audio-asset {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 8px;
}
.ae-audio-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.ae-audio-player {
  width: 100%;
  max-width: 100%;
  height: 32px;
  color-scheme: inherit;
}
</style>
