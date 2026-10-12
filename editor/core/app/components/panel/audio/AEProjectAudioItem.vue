<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { canonicalAudioJson, createMusicMetadata } from '@advjs/audio'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import { useProjectAssets } from '../../../stores/useProjectAssets'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'
import AEMusicMetadataFields from './AEMusicMetadataFields.vue'
import AEMusicReviewActions from './AEMusicReviewActions.vue'
import { audioKindOptions } from './audio-options'

const props = withDefaults(defineProps<{ asset: AdvAssetEntry, visible?: boolean }>(), { visible: true })
const assets = useProjectAssets()
const project = useProjectStore()
const drafts = useProjectDrafts()
const title = shallowRef(props.asset.title ?? '')
const description = shallowRef(props.asset.alt ?? '')
const kind = shallowRef(props.asset.kind)
const music = shallowRef(props.asset.music ? JSON.parse(JSON.stringify(props.asset.music)) as NonNullable<AdvAssetEntry['music']> : undefined)
const loop = shallowRef(props.asset.loop ?? true)
const auditioned = shallowRef(false)
let expectedFiles = project.project!.files
let expectedAsset = JSON.parse(JSON.stringify(props.asset)) as AdvAssetEntry
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
function musicKey(value: AdvAssetEntry['music']) {
  const plain = JSON.parse(JSON.stringify(value ?? null))
  try {
    return canonicalAudioJson(plain)
  }
  catch { return JSON.stringify(plain) }
}
function matches(asset: AdvAssetEntry) {
  return title.value === (asset.title ?? '') && description.value === (asset.alt ?? '') && kind.value === asset.kind && musicKey(music.value) === musicKey(asset.music) && loop.value === (asset.loop ?? true)
}
const dirty = computed(() => !matches(props.asset))
watch(dirty, dirty => drafts.register(id, { dirty, save }), { immediate: true })
watch(() => JSON.stringify(props.asset), () => {
  if (matches(expectedAsset)) {
    title.value = props.asset.title ?? ''
    description.value = props.asset.alt ?? ''
    kind.value = props.asset.kind
    music.value = props.asset.music ? JSON.parse(JSON.stringify(props.asset.music)) : undefined
    loop.value = props.asset.loop ?? true
    expectedFiles = project.project!.files
    expectedAsset = JSON.parse(JSON.stringify(props.asset))
  }
})
let generation = 0
function releasePreview() {
  generation++
  auditioned.value = false
  player.value?.pause()
  if (src.value.startsWith('blob:'))
    URL.revokeObjectURL(src.value)
  src.value = ''
}
function markAudition(event: Event) {
  if (event.isTrusted && player.value && !player.value.paused && player.value.currentSrc === src.value && Number.isFinite(player.value.duration))
    auditioned.value = true
}
watch([
  () => project.workspace,
  () => JSON.stringify([props.asset.id, props.asset.type, props.asset.kind, props.asset.state, props.asset.path, props.asset.url, props.asset.objectKey, props.asset.sha256, props.asset.bytes, props.asset.mimeType, props.asset.variants, props.asset.music, props.asset.license, assets.manifest?.profiles]),
], releasePreview)
watch(() => project.resourceRevision, () => {
  // A verified Blob retains its immutable bytes across equivalent snapshots.
  // Unhashed legacy sources must still be reloaded after external changes.
  if (!props.asset.sha256)
    releasePreview()
})
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
async function playAudition() {
  const media = player.value
  const request = generation
  if (!src.value || !media || !props.visible)
    return
  try {
    // Invoke the existing verified element during the author's actual gesture.
    await media.play()
    if (request !== generation)
      media.pause()
  }
  catch {
    if (request === generation)
      error.value = '浏览器未能播放音频，请检查编码或点击音频播放控件重试。'
  }
}
onBeforeUnmount(() => {
  releasePreview()
  drafts.remove(id)
})
async function save() {
  try {
    await assets.upsert({ ...props.asset, title: title.value, alt: description.value, kind: kind.value, ...(kind.value === 'bgm' ? { music: music.value, loop: loop.value, ...(music.value?.rights?.license ? { license: music.value.rights.license } : {}) } : { music: undefined }) }, expectedFiles, expectedAsset)
    expectedFiles = project.project!.files
    expectedAsset = JSON.parse(JSON.stringify(props.asset))
    music.value = props.asset.music ? JSON.parse(JSON.stringify(props.asset.music)) : undefined
    loop.value = props.asset.loop ?? true
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
  music.value = props.asset.music ? JSON.parse(JSON.stringify(props.asset.music)) : undefined
  loop.value = props.asset.loop ?? true
  expectedFiles = project.project!.files
  expectedAsset = JSON.parse(JSON.stringify(props.asset))
  error.value = ''
}
async function keepDraft() {
  expectedFiles = project.project!.files
  expectedAsset = JSON.parse(JSON.stringify(props.asset))
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
    <audio v-if="src" ref="player" :src="src" controls preload="none" :aria-label="`项目音频试听 ${asset.title || asset.id}`" class="ae-audio-player" @playing="markAudition" @error="error = '无法播放资源，请检查文件或编码'" />
    <div v-if="src" class="ae-resource-actions">
      <AGUIButton :disabled="!visible" data-testid="asset-play-verified" @click="playAudition">
        播放试听
      </AGUIButton>
    </div>
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
      <template v-if="kind === 'bgm'">
        <AGUIButton v-if="!music" :disabled="!writable" data-testid="music-create-metadata" @click="music = createMusicMetadata({ usage: 'background', source: { type: 'manual' } })">
          建立音乐来源与审核记录
        </AGUIButton>
        <AEMusicMetadataFields v-if="music" v-model="music" :disabled="!writable" />
        <AGUIProperty label="播放循环默认值">
          <AGUISelect label="音乐资源循环默认值" :model-value="loop ? 'yes' : 'no'" :options="[{ value: 'yes', label: '循环' }, { value: 'no', label: '单次曲目' }]" :disabled="!writable" @update:model-value="loop = $event === 'yes'" />
        </AGUIProperty>
      </template>
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
    <AEMusicReviewActions v-if="asset.kind === 'bgm'" :asset="asset" :writable="writable" :dirty="dirty" :auditioned="auditioned" :visible="visible" />
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
