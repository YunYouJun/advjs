<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { useScreenLock } from '@advjs/core'

import { useFullscreen } from '@vueuse/core'
import { TabsContent, TabsIndicator, TabsList, TabsRoot } from 'radix-vue'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores'
import AudioVolume from './settings/AudioVolume.vue'

const { t } = useI18n()

const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()

const settings = useSettingsStore()
const items = computed<AdvMenuItemProps[]>(() => {
  return [
    {
      type: 'Checkbox',
      label: t('settings.landscape'),
      props: {
        checked: orientation.value === 'landscape',
        onClick: async () => {
          if (isFullscreen.value) {
            await exit()
            toggle('portrait')
          }
          else {
            await enter()
            toggle('landscape')
          }
        },
      },
    },
    {
      label: t('settings.fullscreen'),
      type: 'Checkbox',
      props: {
        checked: isFullscreen.value,
        onClick: settings.toggleFullScreen,
      },
    },
  ]
})

const currentTab = ref('common')
</script>

<template>
  <div class="menu-panel grid grid-cols-24" gap="0" h="full" text="2xl">
    <div col="span-18" class="overflow-y-scroll">
      <TabsRoot class="shadow-blackA4 w-full flex flex-col" :default-value="currentTab">
        <TabsList class="relative flex shrink-0 border-b border-dark-100" aria-label="Manage your account">
          <TabsIndicator
            class="absolute bottom-0 left-0 h-[4px] w-$radix-tabs-indicator-size translate-x-$radix-tabs-indicator-position rounded-full transition-[width,transform] duration-300"
          >
            <div class="h-full w-full bg-blue-600" />
          </TabsIndicator>
          <AdvMenuPanelTabTitle :title="t('settings.title')" value="common" />
          <AdvMenuPanelTabTitle title="Speech" value="speech" />
        </TabsList>
        <TabsContent
          class="grow p-5 outline-none"
          value="common"
        >
          <div grid="~ cols-12 gap-5" p="6">
            <TextPlayPreview />

            <HorizontalDivider />

            <MenuItem v-for="(item, i) in items" :key="i" :item="item" />

            <HorizontalDivider />
            <AudioVolume />

            <HorizontalDivider />

            <ToggleSourceMd />

            <HorizontalDivider />

            <GameSettings />
          </div>
        </TabsContent>

        <TabsContent
          class="grow p-5 outline-none"
          value="speech"
        >
          <div grid="~ cols-12 gap-5" p="6">
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
