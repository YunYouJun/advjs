<script setup lang="ts">
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { computed, reactive, useId } from 'vue'
import { useVoiceDesign } from '../../../composables/useVoiceDesign'
import AEVoiceDesignCandidates from './AEVoiceDesignCandidates.vue'
import AEVoiceDesignForm from './AEVoiceDesignForm.vue'
import AEVoiceDesignPreviewForm from './AEVoiceDesignPreviewForm.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const designer = reactive(useVoiceDesign(() => props.visible))
const id = useId()
const voiceOptions = computed(() => designer.voices.map(voice => ({ value: voice.id, label: `${voice.label} · ${voice.version} · ${voice.characterId}` })))
const currentBinding = computed(() => designer.snapshot?.speakers.find(speaker => speaker.id === designer.selected?.characterId)?.profile?.locales?.[designer.locale]?.providers[designer.providerId])
const canApply = computed(() => Boolean(designer.selectedSample) && !designer.pending && (!currentBinding.value || designer.replaceBinding))
</script>

<template>
  <section class="ae-voice-design" aria-label="音色设计" :aria-busy="designer.loading || designer.pending">
    <AGUIToolbar :items="[]" label="音色设计">
      <template #before-toolbar>
        <span>音色设计 · {{ designer.voices.length }} 个版本</span>
      </template>
      <template #after-toolbar>
        <AGUIButton :loading="designer.loading" :disabled="designer.pending || !designer.hasTransport" data-testid="design-reload" @click="designer.reload">
          刷新状态
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <AGUIForm class="ae-design-workspace" padded>
      <p v-if="!designer.hasTransport" class="ae-resource-caption" role="status">
        当前工作区未配置音色设计服务。请通过可信本地项目宿主连接，供应商插件与预设由宿主配置。
      </p>
      <p v-else-if="!designer.available" class="ae-resource-caption" role="status">
        当前宿主尚未配置可用的音色插件与预设。
      </p>
      <template v-if="designer.snapshot">
        <AGUIProperty :for="`${id}-selected-voice`" label="已保存版本">
          <AGUISelect :id="`${id}-selected-voice`" :model-value="designer.selectedVoiceId" label="已保存音色版本" :options="voiceOptions" :disabled="designer.pending || designer.dirty" @update:model-value="designer.selectVoice(String($event))" />
        </AGUIProperty>
        <div class="ae-resource-actions">
          <AGUIButton :disabled="designer.pending || !designer.available || designer.dirty" data-testid="design-new" @click="designer.newVersion()">
            新建音色
          </AGUIButton>
          <AGUIButton :disabled="designer.pending || !designer.selected || designer.dirty" data-testid="design-new-version" @click="designer.newVersion(true)">
            复制为新版本
          </AGUIButton>
          <AGUIButton v-if="designer.dirty" :disabled="designer.pending" data-testid="design-discard" @click="designer.discardDraft">
            放弃未保存草稿
          </AGUIButton>
        </div>
        <AGUIDetails v-if="designer.draft" title="设计版本与语言实现" open>
          <p v-if="designer.immutable" class="ae-resource-caption">
            此版本的设计输入不可覆盖。修改意图或供应商条件请复制为新版本，历史样本和对白保持原样。
          </p>
          <AEVoiceDesignForm v-model="designer.draft" :snapshot="designer.snapshot" :id-prefix="id" :disabled="designer.pending || designer.immutable || !designer.available" />
          <p v-if="designer.validation && !designer.immutable" class="ae-resource-error" role="alert">
            {{ designer.validation }}
          </p>
          <div v-if="!designer.immutable" class="ae-resource-actions">
            <AGUIButton theme="primary" :disabled="!designer.canSave" :loading="designer.pending" data-testid="design-save" @click="designer.save">
              保存设计版本
            </AGUIButton>
          </div>
        </AGUIDetails>
        <template v-if="designer.selected && !designer.dirty">
          <AEVoiceDesignPreviewForm v-model:locale="designer.locale" v-model:provider-id="designer.providerId" v-model:text="designer.text" v-model:max-characters="designer.maxCharacters" v-model:allow-unknown-cost="designer.allowUnknownCost" v-model:budget-reviewed="designer.budgetReviewed" :id-prefix="id" :locale-options="designer.localeOptions" :provider-options="designer.providerOptions" :pending="designer.pending" :can-plan="designer.canPlan" :review="designer.review" @plan="designer.plan" @execute="designer.execute" />
          <AEVoiceDesignCandidates v-model:replace-selected="designer.replaceSelected" :previews="designer.previews" :samples="designer.samples" :selected-sample="designer.selectedSample" :source="designer.source" :playing-preview-id="designer.playingPreviewId" :pending="designer.pending" @audition="designer.audition" @sample="designer.auditionSample" @register="designer.register" @cancel="designer.cancel" @select="designer.selectSample" @stop="designer.stopAudio" @playback-blocked="designer.status = '浏览器要求再次交互，请点击音频播放控件继续试听。'" />
          <AGUIDetails title="应用角色／旁白音色" open>
            <p class="ae-resource-caption">
              只应用 {{ designer.selected.characterId }} 的 {{ designer.locale }}／{{ designer.providerId }} 绑定及当前版本意图，其他语言和供应商保留。不会改动对白配音账本。
            </p>
            <AGUICheckbox v-if="currentBinding" v-model:checked="designer.replaceBinding" label="我确认替换此语言／供应商的已有角色音色绑定" :disabled="designer.pending" data-testid="design-replace-binding" />
            <div class="ae-resource-actions">
              <AGUIButton theme="primary" :disabled="!canApply" :loading="designer.pending" data-testid="design-apply" @click="designer.applyProfile">
                应用已审核音色
              </AGUIButton>
            </div>
          </AGUIDetails>
        </template>
      </template>
      <p v-if="designer.error" class="ae-resource-error" role="alert">
        {{ designer.error }}
      </p>
      <p v-if="designer.status" class="ae-resource-caption" role="status">
        {{ designer.status }}
      </p>
    </AGUIForm>
  </section>
</template>

<style scoped>
.ae-voice-design {
  min-width: 0;
}
</style>
