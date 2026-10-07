<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot } from 'reka-ui'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AdvSettingsUtilities from './AdvSettingsUtilities.vue'
import AudioVolume from './settings/AudioVolume.vue'
import DisplaySettings from './settings/DisplaySettings.vue'

const { t } = useI18n()
const tabs = ['dialogue', 'display', 'audio', 'speech'] as const
const currentTab = shallowRef<(typeof tabs)[number]>('dialogue')
</script>

<template>
  <TabsRoot v-model="currentTab" class="adv-settings-panel" :unmount-on-hide="false">
    <header class="adv-settings-header">
      <TabsList class="adv-settings-tab-list" :aria-label="t('settings.title')">
        <AdvMenuPanelTabTitle v-for="tab in tabs" :key="tab" :title="t(`settings.tabs.${tab}`)" :value="tab" />
      </TabsList>
      <AdvSettingsUtilities />
    </header>
    <div class="adv-settings-tabs">
      <TabsContent class="adv-settings-content" value="dialogue">
        <div class="adv-settings-fields">
          <TextPlayPreview />
          <HorizontalDivider />
          <DialogBarSettings />
        </div>
      </TabsContent>
      <TabsContent class="adv-settings-content" value="display">
        <div class="adv-settings-fields">
          <DisplaySettings />
        </div>
      </TabsContent>
      <TabsContent class="adv-settings-content" value="audio">
        <div class="adv-settings-fields">
          <AudioVolume />
        </div>
      </TabsContent>
      <TabsContent class="adv-settings-content" value="speech">
        <div class="adv-settings-fields">
          <SpeechSynthesis />
        </div>
      </TabsContent>
    </div>
    <RightTools />
  </TabsRoot>
</template>

<style lang="scss">
@use '../../styles/settings.scss';
</style>
