<script setup lang="ts">
import AGUITabPanel from '@advjs/gui/client/components/tabs/AGUITabPanel.vue'
import AGUITabs from '@advjs/gui/client/components/tabs/AGUITabs.vue'
import { shallowRef } from 'vue'
import { useAudioStore } from '../../../stores/useAudioStore'
import AEAudioMixerPanel from './AEAudioMixerPanel.vue'
import AEAudioPronunciationPanel from './AEAudioPronunciationPanel.vue'
import AEAudioVoiceProfilesPanel from './AEAudioVoiceProfilesPanel.vue'
import AEProjectAudioPanel from './AEProjectAudioPanel.vue'
import AEVoiceDesignPanel from './AEVoiceDesignPanel.vue'
import AEVoiceJobsPanel from './AEVoiceJobsPanel.vue'
import AEVoiceLedgerPanel from './AEVoiceLedgerPanel.vue'
import '../../../styles/resource-panel.scss'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const project = useProjectStore()
const audio = useAudioStore()
const selected = shallowRef<string | number>('assets')
const tabs = [{ key: 'assets', title: '音频资源' }, { key: 'design', title: '音色设计' }, { key: 'voice', title: '对白配音' }, { key: 'jobs', title: '配音任务' }, { key: 'profiles', title: '旁白声音' }, { key: 'pronunciation', title: '发音词典' }, { key: 'mixer', title: '混音配置' }]
</script>

<template>
  <div class="ae-resource-panel ae-audio-workspace">
    <p v-if="!project.workspace" class="ae-resource-empty" role="status">
      打开项目后，可管理原生音频资源、对白配音和混音配置。
    </p>
    <p v-if="project.workspace && !audio.supportedRoot" class="ae-resource-caption" role="status">
      当前项目使用自定义内容根。音频作者工作区目前需要 adv 目录；导入、配音绑定和混音保存已禁用。
    </p>
    <AGUITabs v-if="project.workspace" v-model="selected" :list="tabs" label="音频工作区">
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
</style>
