<script setup lang="ts">
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import AGUITextarea from '@advjs/gui/client/components/textarea/AGUITextarea.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, reactive, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useAudioLedger } from '../../../composables/useAudioLedger'
import AEVoiceComparePanel from './AEVoiceComparePanel.vue'
import AEVoiceTakeReview from './AEVoiceTakeReview.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const ledger = reactive(useAudioLedger())
const id = useId()
const player = useTemplateRef<HTMLAudioElement>('player')
const advancedButton = useTemplateRef<InstanceType<typeof AGUIButton>>('advancedButton')
const advanced = shallowRef(false)
const AdvancedListening = defineAsyncComponent(() => import('./listening/AEVoiceListeningPanel.vue'))
const sourceOptions = [{ value: 'system', label: '系统预设声音' }, { value: 'designed', label: '设计声音' }, { value: 'recorded', label: '原创录音' }, { value: 'cloned', label: '参考声音 / 克隆' }]
const canRegister = computed(() => ledger.writable && Boolean(ledger.candidateSource) && /^[a-f0-9]{64}$/u.test(ledger.profileRevision) && (ledger.candidateSource !== 'cloned' || Boolean(ledger.license.trim() && ledger.subject.trim() && ledger.consentRecord.trim())))
watch(() => props.visible, (visible) => {
  if (!visible) {
    player.value?.pause()
    ledger.clearPreview()
  }
})
watch(() => ledger.previewSource, () => player.value?.pause())
onBeforeUnmount(() => player.value?.pause())
watch(advanced, () => {
  player.value?.pause()
  ledger.clearPreview()
})
watch(() => ledger.snapshot, (snapshot) => {
  if (!snapshot)
    advanced.value = false
})
function openAdvanced() {
  advanced.value = true
}
async function closeAdvanced() {
  advanced.value = false
  await nextTick()
  advancedButton.value?.$el?.focus()
}
function playbackError() {
  ledger.clearPreview()
  ledger.error = '无法播放此配音；请重新载入或检查媒体编码。'
}
</script>

<template>
  <section class="ae-voice-ledger" aria-label="对白配音账本" :aria-busy="ledger.loading || ledger.pending">
    <AGUIToolbar :items="[]" label="对白配音账本">
      <template #before-toolbar>
        <span>对白配音 · {{ ledger.lineOptions.length }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton ref="advancedButton" :disabled="advanced || ledger.reviewLoading || !ledger.reviewRows.length" data-testid="voice-listening-open" @click="openAdvanced">
          高级听审
        </AGUIButton>
        <AGUIButton :loading="ledger.loading" :disabled="ledger.pending" data-testid="ledger-refresh" @click="ledger.reload">
          刷新
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="ae-ledger-fields">
      <p v-if="ledger.unboundCount" class="ae-resource-caption" role="status">
        {{ ledger.unboundCount }} 条对白尚无稳定 lineId。先在剧本末尾添加 {#line_&lt;uuidv7&gt;}，再绑定配音。
      </p>
      <p v-if="!ledger.lineOptions.length && !ledger.loading" class="ae-resource-empty" role="status">
        还没有可绑定的对白。账本与剧本均使用同一个稳定 lineId。
      </p>
      <template v-if="ledger.lineOptions.length && !advanced">
        <AGUIProperty label="对白">
          <AGUISelect v-model="ledger.lineId" name="lineId" :options="ledger.lineOptions" label="选择配音对白" :disabled="ledger.pending" />
        </AGUIProperty>
        <AGUIProperty label="已有语言">
          <AGUISelect v-model="ledger.locale" name="locale" :options="ledger.localeOptions" label="对白语言" :disabled="ledger.pending" />
        </AGUIProperty>
        <AGUIProperty :for="`${id}-locale`" label="语言标记">
          <AGUIInput :id="`${id}-locale`" v-model="ledger.locale" placeholder="zh-CN / en" :disabled="ledger.pending" />
        </AGUIProperty>
        <p class="ae-resource-caption">
          {{ ledger.currentLine?.speakerId }} · {{ ledger.lineId }}
        </p>
        <AGUIFormItem :for="`${id}-text`" label="该语言显示台词" label-align="top">
          <AGUITextarea :id="`${id}-text`" v-model="ledger.displayText" :rows="3" :disabled="ledger.pending" />
        </AGUIFormItem>
        <AGUIFormItem :for="`${id}-spoken`" label="口语化文本（可选）" label-align="top">
          <AGUITextarea :id="`${id}-spoken`" v-model="ledger.spokenText" :rows="2" :disabled="ledger.pending" />
        </AGUIFormItem>
        <AGUIProperty v-if="ledger.takeOptions.length" label="历史 take">
          <AGUISelect v-model="ledger.takeId" name="takeId" :options="ledger.takeOptions" label="审核历史配音 take" :disabled="ledger.pending" />
        </AGUIProperty>
        <p v-else class="ae-resource-caption" role="status">
          此语言尚无配音 take；生成候选后，登记和选用分别执行。
        </p>
        <AEVoiceTakeReview v-model:replace="ledger.replaceSelected" v-model:reviewed="ledger.staleReviewed" :take="ledger.take" :selected-take="ledger.binding?.selectedTake" :stale="ledger.takeReview?.stale" :kept="ledger.staleKept" :unavailable="ledger.takeReview?.unavailable" :pending="ledger.pending || ledger.reviewLoading" :writable="ledger.writable" :can-select="ledger.canSelect" :preview-loading="ledger.previewLoading" @preview="ledger.preview()" @select="ledger.select()" @clear="ledger.select(true)" @keep="ledger.confirmCurrent">
          <template #listening>
            <AEVoiceComparePanel :row="ledger.reviewRow" :take-id="ledger.takeId" :preview-take-id="ledger.previewTakeId" :loading="ledger.previewLoading" :pending="ledger.pending || ledger.reviewLoading || advanced" @preview="ledger.preview" @inspect="ledger.takeId = $event" @stop="ledger.clearPreview" />
            <audio v-if="ledger.previewSource" ref="player" :src="ledger.previewSource" controls preload="none" aria-label="对白配音试听" class="ae-ledger-player" @error="playbackError" />
          </template>
        </AEVoiceTakeReview>
        <AGUIDetails title="生成新的配音候选">
          <p v-if="!ledger.canSynthesize" class="ae-resource-caption" role="status">
            当前宿主未接入 TTS 合成服务。可继续审核、试听和选择已有 take。
          </p>
          <div class="ae-resource-actions">
            <AGUIButton :disabled="!ledger.canSynthesize || !ledger.writable || !ledger.currentLine || !ledger.displayText.trim()" :loading="ledger.pending" data-testid="voice-synthesize" @click="ledger.synthesize">
              生成候选
            </AGUIButton>
          </div>
          <template v-if="ledger.candidate">
            <p class="ae-resource-caption">
              {{ ledger.candidate.provider }} · {{ ledger.candidate.model }} · {{ ledger.candidate.providerVoiceId }} · {{ ledger.candidate.durationSeconds }} 秒
            </p>
            <AGUIProperty label="声音来源">
              <AGUISelect v-model="ledger.candidateSource" :options="sourceOptions" label="审核生成声音来源" :disabled="ledger.pending" />
            </AGUIProperty>
            <AGUIProperty :for="`${id}-revision`" label="声音配置 SHA-256">
              <AGUIInput :id="`${id}-revision`" v-model="ledger.profileRevision" :disabled="ledger.pending" />
            </AGUIProperty>
            <template v-if="ledger.candidateSource === 'cloned'">
              <AGUIProperty :for="`${id}-license`" label="许可">
                <AGUIInput :id="`${id}-license`" v-model="ledger.license" :disabled="ledger.pending" />
              </AGUIProperty>
              <AGUIProperty :for="`${id}-subject`" label="权利主体">
                <AGUIInput :id="`${id}-subject`" v-model="ledger.subject" :disabled="ledger.pending" />
              </AGUIProperty>
              <AGUIProperty :for="`${id}-consent`" label="项目同意记录">
                <AGUIInput :id="`${id}-consent`" v-model="ledger.consentRecord" placeholder="docs/consent/voice.md" :disabled="ledger.pending" />
              </AGUIProperty>
            </template>
            <p class="ae-resource-caption">
              登记保留不可变的生成记录，并复制经校验的媒体；不会自动替换已选配音。
            </p>
            <div class="ae-resource-actions">
              <AGUIButton :disabled="!canRegister" :loading="ledger.pending" data-testid="voice-register" @click="ledger.register">
                登记候选 take
              </AGUIButton>
            </div>
          </template>
        </AGUIDetails>
      </template>
      <p v-if="ledger.error" class="ae-resource-error" role="alert">
        {{ ledger.error }}
      </p>
      <AdvancedListening v-if="advanced && ledger.snapshot" :visible="visible" :snapshot="ledger.snapshot" :rows="ledger.reviewRows" @close="closeAdvanced" />
    </div>
  </section>
</template>

<style scoped>
.ae-ledger-fields {
  display: grid;
  gap: 8px;
  padding: 8px;
  container: agui-properties / inline-size;
}
.ae-ledger-player {
  max-width: 100%;
  width: 100%;
  height: 32px;
  color-scheme: inherit;
}
</style>
