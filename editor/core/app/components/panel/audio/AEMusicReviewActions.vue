<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { inspectMusicReview } from '@advjs/audio'
import AGUICheckbox from '@advjs/gui/components/AGUICheckbox.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed, inject, onBeforeUnmount, shallowRef, watch } from 'vue'
import { editorLayoutStateKey } from '../../../extensions/layout-state'
import { useProjectAssets } from '../../../stores/useProjectAssets'
import { useProjectStore } from '../../../stores/useProjectStore'

const props = defineProps<{ asset: AdvAssetEntry, writable: boolean, dirty: boolean, auditioned: boolean, visible: boolean }>()
const assets = useProjectAssets()
const project = useProjectStore()
const layout = inject(editorLayoutStateKey, undefined)
const checked = shallowRef(false)
const pending = shallowRef(false)
const error = shallowRef('')
let sequence = 0
const review = computed(() => inspectMusicReview(props.asset))
const labels = { legacy: '既有音乐 · 未建立专门审核记录', pending: '待试听与许可审核', approved: '此母版已明确批准', rejected: '已拒绝采用', invalid: '音乐审核记录无效' }
watch([
  () => JSON.stringify([props.asset.id, props.asset.type, props.asset.kind, props.asset.state, props.asset.path, props.asset.url, props.asset.objectKey, props.asset.sha256, props.asset.bytes, props.asset.mimeType, props.asset.variants, props.asset.music, props.asset.license]),
  () => props.visible,
  () => project.workspace,
  () => props.dirty,
], () => {
  sequence++
  checked.value = false
  pending.value = false
  error.value = ''
})
onBeforeUnmount(() => {
  sequence++
})
async function approve(status: 'approved' | 'rejected') {
  if (!props.writable || props.dirty || pending.value || !props.asset.sha256 || (status === 'approved' && (!checked.value || !props.auditioned)))
    return
  const current = ++sequence
  pending.value = true
  error.value = ''
  try {
    await assets.reviewMusic(props.asset, status)
  }
  catch (failure) {
    if (current === sequence)
      error.value = failure instanceof Error ? failure.message : String(failure)
  }
  finally {
    if (current === sequence)
      pending.value = false
  }
}
</script>

<template>
  <div class="ae-music-review" :aria-busy="pending">
    <p class="ae-resource-caption" data-testid="music-review-status">
      {{ labels[review.status] }}
    </p>
    <template v-if="asset.music">
      <p v-if="dirty" class="ae-resource-caption">
        先保存用途、来源与许可；这些内容变化后需重新试听并审核。
      </p>
      <AGUICheckbox v-model:checked="checked" label="我已试听，并核对音乐用途、来源与使用许可" :disabled="!writable || dirty || !auditioned || pending" data-testid="music-reviewed" />
      <div class="ae-resource-actions">
        <AGUIButton :disabled="!writable || dirty || !auditioned || !checked || pending || !asset.music.rights?.license.trim()" :loading="pending" data-testid="music-approve" @click="approve('approved')">
          批准用于剧情
        </AGUIButton>
        <AGUIButton :disabled="!writable || dirty || pending || !asset.sha256" data-testid="music-reject" @click="approve('rejected')">
          拒绝采用
        </AGUIButton>
      </div>
    </template>
    <div class="ae-resource-actions">
      <AGUIButton :disabled="!layout || dirty || !review.canBind" data-testid="music-open-flow" @click="layout?.select('main', 'advjs.core/flow-editor')">
        在流程图中绑定
      </AGUIButton>
    </div>
    <p class="ae-resource-caption">
      在章节音频属性或 JSON Flow 音频节点中选择此资源，明确保存后才用于剧情。不会自动替换音乐或设置标题页自动播放。
    </p>
    <p v-if="error" class="ae-resource-error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ae-music-review {
  display: grid;
  gap: 4px;
  min-width: 0;
}
</style>
