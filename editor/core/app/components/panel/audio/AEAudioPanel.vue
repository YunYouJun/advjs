<script setup lang="ts">
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUITabPanel from '@advjs/gui/client/components/tabs/AGUITabPanel.vue'
import AGUITabs from '@advjs/gui/client/components/tabs/AGUITabs.vue'
import { computed, shallowRef, watch } from 'vue'
import { useAudioWorkspaceNavigation } from '../../../composables/useAudioWorkspaceNavigation'
import { useAudioStore } from '../../../stores/useAudioStore'
import AEAudioMixerPanel from './AEAudioMixerPanel.vue'
import AEAudioPronunciationPanel from './AEAudioPronunciationPanel.vue'
import AEAudioVoiceProfilesPanel from './AEAudioVoiceProfilesPanel.vue'
import AEProjectAudioPanel from './AEProjectAudioPanel.vue'
import AEVoiceDesignPanel from './AEVoiceDesignPanel.vue'
import AEVoiceJobsPanel from './AEVoiceJobsPanel.vue'
import AEVoiceLedgerPanel from './AEVoiceLedgerPanel.vue'
import AEVoiceProvidersPanel from './AEVoiceProvidersPanel.vue'
import '../../../styles/resource-panel.scss'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const project = useProjectStore()
const audio = useAudioStore()
const navigation = useAudioWorkspaceNavigation()
const selected = shallowRef<string | number>('assets')
const speaker = computed(() => audio.workflowSpeakerId === 'narrator' ? '旁白' : project.project?.compilation.project.characters.find(character => character.id === audio.workflowSpeakerId)?.name)
watch(() => audio.workspaceRequest, (request) => {
  if (request) {
    selected.value = request.tab
    audio.consumeWorkspaceRequest(request.id)
  }
}, { immediate: true, flush: 'sync' })
const tabs = [{ key: 'assets', title: '音频资源' }, { key: 'design', title: '音色设计' }, { key: 'voice', title: '对白配音' }, { key: 'jobs', title: '配音任务' }, { key: 'profiles', title: '旁白声音' }, { key: 'pronunciation', title: '发音词典' }, { key: 'mixer', title: '混音配置' }, { key: 'providers', title: '供应商与清理' }]
</script>

<template>
  <div class="ae-resource-panel ae-audio-workspace">
    <p v-if="!project.workspace" class="ae-resource-empty" role="status">
      打开项目后，可管理原生音频资源、对白配音和混音配置。
    </p>
    <p v-if="project.workspace && !audio.supportedRoot" class="ae-resource-caption" role="status">
      当前项目使用自定义内容根。音频作者工作区目前需要 adv 目录；导入、配音绑定和混音保存已禁用。
    </p>
    <div v-if="speaker" class="ae-audio-workflow">
      <span>{{ speaker }} · 角色配音</span>
      <AGUIButton @click="navigation.open('design', audio.workflowSpeakerId)">
        音色设计与应用
      </AGUIButton>
      <AGUIButton @click="navigation.open('jobs', audio.workflowSpeakerId)">
        生成角色对白
      </AGUIButton>
      <AGUIButton @click="navigation.open('voice', audio.workflowSpeakerId)">
        试听与选用
      </AGUIButton>
      <AGUIButton :disabled="!navigation.available.value" @click="navigation.preview">
        游戏预览
      </AGUIButton>
      <AGUIButton @click="audio.clearWorkflowSpeaker">
        查看全部角色
      </AGUIButton>
    </div>
    <AGUITabs v-if="project.workspace" v-model="selected" :list="tabs" label="音频工作区">
      <AGUITabPanel v-show="selected === 'providers'" value="providers" force-mount>
        <AEVoiceProvidersPanel :visible="visible && selected === 'providers'" />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'assets'" value="assets" force-mount>
        <AEProjectAudioPanel :visible="visible && selected === 'assets'" />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'voice'" value="voice" force-mount>
        <AEVoiceLedgerPanel :visible="visible && selected === 'voice'" />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'design'" value="design" force-mount>
        <AEVoiceDesignPanel :visible="visible && selected === 'design'" />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'mixer'" value="mixer" force-mount>
        <AEAudioMixerPanel />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'jobs'" value="jobs" force-mount>
        <AEVoiceJobsPanel :visible="visible && selected === 'jobs'" />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'profiles'" value="profiles" force-mount>
        <AEAudioVoiceProfilesPanel />
      </AGUITabPanel>
      <AGUITabPanel v-show="selected === 'pronunciation'" value="pronunciation" force-mount>
        <AEAudioPronunciationPanel />
      </AGUITabPanel>
    </AGUITabs>
  </div>
</template>

<style scoped>
.ae-audio-workspace {
  height: 100%;
  min-height: 0;
}
.ae-audio-workflow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
}
</style>
