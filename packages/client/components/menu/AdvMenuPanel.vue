<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot } from 'reka-ui'
import { ref } from 'vue'

import { useI18n } from 'vue-i18n'
import AudioVolume from './settings/AudioVolume.vue'

const { t } = useI18n()

const currentTab = ref('common')
</script>

<template>
  <div class="menu-panel settings-panel">
    <div class="settings-content">
      <TabsRoot class="shadow-blackA4 flex flex-col w-full" :default-value="currentTab">
        <TabsList class="border-b border-dark-100 flex shrink-0 relative" :aria-label="t('settings.title')">
          <TabsIndicator
            class="rounded-full h-[4px] w-$radix-tabs-indicator-size translate-x-$radix-tabs-indicator-position transition-[width,transform] duration-300 bottom-0 left-0 absolute"
          >
            <div class="bg-blue-600 h-full w-full" />
          </TabsIndicator>
          <AdvMenuPanelTabTitle :title="t('settings.title')" value="common" />
          <AdvMenuPanelTabTitle :title="t('settings.speech_synthesis')" value="speech" />
        </TabsList>
        <TabsContent
          class="settings-tab outline-none grow"
          value="common"
        >
          <div class="settings-fields">
            <TextPlayPreview />

            <HorizontalDivider />

            <AudioVolume />

            <HorizontalDivider />
            <AdvMotionSettings />

            <!-- <HorizontalDivider /> -->
            <!-- <GameSettings /> -->
          </div>
        </TabsContent>

        <TabsContent
          class="settings-tab outline-none grow"
          value="speech"
        >
          <div class="settings-fields">
            <SpeechSynthesis />
          </div>
        </TabsContent>
      </TabsRoot>
      <!-- <div h="full" border="gray right-2" /> -->
    </div>

    <RightTools />

    <!-- <div col="span-1" class="flex justify-center items-center" /> -->
  </div>
</template>

<style scoped>
.settings-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  width: 100%;
  min-height: 0;
  padding-top: 56px;
  box-sizing: border-box;
  overflow: auto;
  font-size: 16px;
}

.settings-content {
  min-width: 0;
  overflow: auto;
}

.settings-tab {
  padding: 16px;
}

.settings-fields {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: center;
  gap: 12px;
}

.settings-panel :deep([role='tab']) {
  padding: 12px;
  min-height: 44px;
}

.settings-panel :deep(h2),
.settings-panel :deep(.adv-menu-item--label) {
  font-size: 18px;
}

.settings-panel :deep(.adv-menu-item--label) {
  justify-content: flex-start;
}

.settings-panel :deep(.adv-radio) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.settings-panel :deep(.adv-text-button),
.settings-panel :deep(.adv-checkbox),
.settings-panel :deep(.adv-motion-settings button) {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  font-size: 16px;
}

.settings-panel :deep(.adv-slider-input) {
  min-height: 44px;
  color: inherit;
  font-size: 16px;
}

.settings-panel :deep(.settings-tools) {
  grid-column: auto;
  height: auto;
  margin: 0;
  padding: 12px;
  justify-content: flex-start;
}

.settings-panel :deep(.adv-button) {
  min-height: 44px;
  margin: 4px 0;
  padding: 8px 12px;
  font-size: 16px;
}

@container (max-width: 600px) {
  .settings-panel {
    display: block;
  }

  .settings-panel :deep(.adv-menu-item--label),
  .settings-panel :deep(.adv-menu-item--container),
  .settings-panel :deep(.adv-motion-settings) {
    grid-column: 1 / -1;
  }

  .settings-panel :deep(.settings-tools) {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
}
</style>
