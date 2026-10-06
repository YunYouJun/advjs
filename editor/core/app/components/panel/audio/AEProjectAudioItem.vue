<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { useProjectAssets } from '~/stores/useProjectAssets'
import { useProjectDrafts } from '~/stores/useProjectDrafts'

const props = withDefaults(defineProps<{ asset: AdvAssetEntry, visible?: boolean }>(), { visible: true })
const assets = useProjectAssets()
const project = useProjectStore()
const drafts = useProjectDrafts()
const title = ref(props.asset.title ?? '')
const description = ref(props.asset.alt ?? '')
const kind = ref(props.asset.kind)
let expectedFiles = project.project!.files
const player = ref<HTMLAudioElement>()
watch(() => props.visible, (visible) => {
  if (!visible)
    player.value?.pause()
})
const src = ref('')
const error = ref('')
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
let mediaRevision = ''
watch(() => JSON.stringify([props.asset.path, props.asset.url, props.asset.variants, assets.manifest?.profiles, project.resourceRevision]), async () => {
  const request = ++generation
  try {
    const media = await assets.media(props.asset)
    if (request !== generation || media.revision === mediaRevision) {
      if (media.src.startsWith('blob:'))
        URL.revokeObjectURL(media.src)
      return
    }
    player.value?.pause()
    if (src.value.startsWith('blob:'))
      URL.revokeObjectURL(src.value)
    mediaRevision = media.revision
    src.value = media.src
    error.value = ''
  }
  catch (failure) {
    if (request === generation) {
      src.value = ''
      error.value = `资源缺失：${String(failure)}`
    }
  }
}, { immediate: true })
onBeforeUnmount(() => {
  generation++
  player.value?.pause()
  if (src.value.startsWith('blob:'))
    URL.revokeObjectURL(src.value)
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
  <li class="ae-resource-row flex-col items-stretch" :data-asset-id="asset.id">
    <label>名称<AGUIInput v-model="title" aria-label="音频名称" /></label>
    <label>描述<AGUIInput v-model="description" aria-label="音频描述" /></label>
    <label>用途<select v-model="kind" aria-label="音频用途" class="agui-input"><option value="bgm">BGM</option><option value="sfx">音效</option><option value="voice">语音</option></select></label>
    <audio ref="player" :src="src" controls preload="metadata" aria-label="项目音频试听" @error="error = '无法播放资源，请检查文件或编码'" />
    <div class="ae-resource-actions">
      <AGUIButton :disabled="!dirty" @click="save">
        保存音频
      </AGUIButton><AGUIButton @click="remove">
        移除音频
      </AGUIButton>
    </div>
    <div v-if="error" class="ae-resource-actions">
      <AGUIButton @click="reloadExternal">
        载入外部版本
      </AGUIButton><AGUIButton @click="keepDraft">
        保留草稿并覆盖
      </AGUIButton>
    </div>
    <p v-if="error" role="alert" class="ae-resource-error">
      {{ error }}
    </p>
  </li>
</template>
