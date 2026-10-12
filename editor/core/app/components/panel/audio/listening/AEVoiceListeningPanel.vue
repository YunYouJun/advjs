<script setup lang="ts">
import type { VoiceReviewRow } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, reactive, useId, useTemplateRef, watch } from 'vue'
import { useVoiceListening } from '../../../../composables/useVoiceListening'
import { useVoiceListeningPlayback } from '../../../../composables/useVoiceListeningPlayback'
import AEVoiceListeningEnvironment from './AEVoiceListeningEnvironment.vue'
import AEVoiceListeningRating from './AEVoiceListeningRating.vue'

const props = defineProps<{ snapshot: VoiceAuthoringSnapshot, rows: VoiceReviewRow[], visible: boolean }>()
const emit = defineEmits<{ close: [] }>()
const id = useId()
const listening = reactive(useVoiceListening({ rows: () => props.rows, snapshot: () => props.snapshot }))
const player = useTemplateRef<HTMLAudioElement>('player')
const playback = reactive(useVoiceListeningPlayback({ catalog: () => props.snapshot.catalog, visible: () => props.visible, player, observe: (sampleId, observation) => listening.record(sampleId, observation) }))
const sampleOptions = computed(() => listening.session?.samples.map(sample => ({ value: sample.id, label: `${listening.anonymousSamples.find(item => item.id === sample.id)?.groupId} · ${sample.id} · 完整播放 ${sample.endedCount} 次` })) ?? [])
watch([() => listening.activeSampleId, () => listening.session?.id, () => props.snapshot.revision], () => playback.stop())
async function restore(event: Event) {
  const input = event.target as HTMLInputElement
  playback.stop()
  await listening.restore(input.files?.[0])
  input.value = ''
}
function close() {
  playback.stop()
  emit('close')
}
</script>

<template>
  <section class="ae-listening-panel" aria-label="高级匿名听审">
    <div class="ae-listening-toolbar">
      <strong>高级听审</strong>
      <AGUIButton data-testid="voice-listening-close" @click="close">
        返回日常试听
      </AGUIButton>
    </div>
    <p class="ae-resource-caption">
      匿名六维人工评分；不等同标准 MOS，不自动生成分数、选用配音或修改玩家资源。
    </p>
    <p v-if="!listening.privateScope" class="ae-resource-caption" role="status">
      当前项目没有私有恢复标识。关闭前请导出 JSON，之后可手动恢复。
    </p>
    <template v-if="!listening.session">
      <AGUIProperty label="听审范围">
        <AGUISelect v-model="listening.groupId" :options="listening.groupOptions" label="选择高级听审候选组" />
      </AGUIProperty>
      <p v-if="!listening.choices.length" class="ae-resource-caption" role="status">
        当前项目没有两份同对白、语言、说话人与实际口语文本的可用候选。
      </p>
      <fieldset v-else class="ae-listening-candidates">
        <legend>选择 2–32 份候选（进入后隐去来源）</legend>
        <AGUICheckbox v-for="choice in listening.choices" :key="choice.candidate.takeId" :label="choice.label" :checked="listening.selectedIds.includes(choice.candidate.takeId)" :disabled="listening.selectedIds.length >= 32 && !listening.selectedIds.includes(choice.candidate.takeId)" @update:checked="listening.toggle(choice.candidate.takeId, $event)" />
      </fieldset>
      <AGUIButton :disabled="!listening.canCreate" data-testid="voice-listening-create" @click="listening.create">
        开始匿名听审 · {{ listening.selectedIds.length }} 份
      </AGUIButton>
    </template>
    <template v-else>
      <AEVoiceListeningEnvironment :environment="listening.session.environment" @update="listening.updateEnvironment" />
      <AGUIProperty label="匿名候选">
        <AGUISelect v-model="listening.activeSampleId" :options="sampleOptions" label="选择匿名听审候选" />
      </AGUIProperty>
      <template v-if="listening.activeSample">
        <p class="ae-listening-prose">
          {{ listening.activeAnonymousSample?.groupId }} · {{ listening.activeAnonymousSample?.spokenText }}
        </p>
        <p class="ae-resource-caption">
          同一个 G 编号代表同对白、语言、说话人与口语文本。跨组分别评分，不作同文 A/B 比较。
        </p>
        <p v-if="listening.targetIntent" class="ae-resource-caption">
          当前角色目标：{{ listening.targetIntent }}。这是当前配置；历史生成时的目标可能不同{{ listening.activeSample.candidate.stale ? '，此候选仍需复审' : '' }}。
        </p>
        <p v-else class="ae-resource-caption">
          本听审没有可信的目标风格依据，风格契合度请选 NA。
        </p>
        <p class="ae-resource-caption">
          本听审未提供可信的匿名参考音频，参考一致性请选 NA；A/B 另一份 take 不代表实际 conditioning 参考。
        </p>
        <div class="ae-listening-toolbar">
          <AGUIButton :loading="playback.loading" data-testid="voice-listening-load" @click="playback.load(listening.activeSample.id, listening.activeSample.candidate)">
            载入 {{ listening.activeSample.id }} 试听
          </AGUIButton>
          <AGUIButton :disabled="!playback.source && !playback.loading" @click="playback.stop">
            停止并释放音频
          </AGUIButton>
        </div>
        <audio v-if="playback.source" ref="player" :src="playback.source" controls preload="none" :aria-label="`${playback.activeId} 匿名配音试听`" class="ae-listening-player" @loadedmetadata="playback.observe" @play="playback.observe" @playing="playback.observe" @timeupdate="playback.observe" @pause="playback.observe" @ended="playback.observe" @waiting="playback.observe" @seeking="playback.observe" @seeked="playback.observe" @ratechange="playback.observe" @error="playback.failed" />
        <p class="ae-resource-caption">
          请用正常速度连续完整试听；跳转、恢复的旧覆盖和模拟事件不算本次真人试听。
        </p>
        <AEVoiceListeningRating :sample="listening.activeSample" @update="listening.updateReview" />
      </template>
      <p class="ae-resource-caption" role="status">
        {{ listening.inspection?.eligibleHumanReview ? '评分与播放覆盖满足人工听审要求。' : '尚有听审要求未完成。' }}
      </p>
      <ul v-if="listening.pendingReasons.length" class="ae-listening-reasons">
        <li v-for="reason in listening.pendingReasons" :key="reason">
          {{ reason }}
        </li>
      </ul>
      <AGUICheckbox v-model:checked="listening.humanConfirmed" label="我已亲自听完所有候选；评分与设备信息由我填写，不是自动或模拟评分" />
      <div class="ae-listening-toolbar">
        <AGUIButton :disabled="!listening.humanConfirmed || !listening.inspection?.canAttest" data-testid="voice-listening-attest" @click="listening.attest">
          确认人工听审
        </AGUIButton>
        <AGUIButton data-testid="voice-listening-export" @click="listening.download">
          导出听审 JSON
        </AGUIButton>
        <AGUIButton @click="playback.stop(); listening.reset()">
          重新选择候选
        </AGUIButton>
      </div>
    </template>
    <label class="ae-listening-import" :for="`${id}-import`">恢复听审 JSON
      <input :id="`${id}-import`" type="file" accept="application/json,.json" @change="restore">
    </label>
    <p v-if="listening.status" class="ae-resource-caption" role="status">
      {{ listening.status }}
    </p>
    <p v-if="listening.error || playback.error" class="ae-resource-error" role="alert">
      {{ listening.error || playback.error }}
    </p>
  </section>
</template>

<style scoped>
.ae-listening-panel {
  min-width: 0;
  display: grid;
  gap: 8px;
  container: agui-properties / inline-size;
}
.ae-listening-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.ae-listening-toolbar strong {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}
.ae-listening-candidates {
  min-width: 0;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--agui-c-divider);
}
.ae-listening-candidates legend {
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.ae-listening-prose {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.ae-listening-player {
  width: 100%;
  max-width: 100%;
  height: 32px;
  color-scheme: inherit;
}
.ae-listening-reasons {
  padding-left: 18px;
  margin: 0;
  font-size: 12px;
  color: var(--agui-c-text-2);
}
.ae-listening-import {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  font-size: 12px;
}
.ae-listening-import input {
  min-width: 0;
  max-width: 100%;
  font: inherit;
}
</style>
