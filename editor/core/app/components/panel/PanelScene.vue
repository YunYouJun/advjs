<script lang="ts" setup>
import { useFullscreen, useStorage } from '@vueuse/core'
import { ref } from 'vue'

const { t } = useI18n()
const tabList = computed(() => [
  { title: t('panels.game'), key: 'game', icon: 'i-ri-gamepad-line' },
  { title: t('panels.character'), key: 'character', icon: 'i-ri-user-line' },
  { title: t('panels.audio'), key: 'audio', icon: 'i-ri-music-line' },
  { title: t('panels.flow'), key: 'flow-editor', icon: 'i-ri-flow-chart' },
  { title: t('panels.assets'), key: 'asset-store', icon: 'i-ri-store-line' },
  { title: t('panels.dashboard'), key: 'dashboard', icon: 'i-ri-dashboard-line' },
])

const app = useAppStore()
const curTab = useStorage('cur-scene-tab', 'game')
/**
 * change tab key
 */
function changeTab(index: number) {
  curTab.value = tabList.value[index]?.key

  if (curTab.value === 'game') {
    app.activeInspector = 'file'
  }
}

const fullscreenEl = ref<HTMLElement | null>(null)
const { isFullscreen, toggle } = useFullscreen(fullscreenEl)
function toggleFullscreen() {
  toggle()
}
</script>

<template>
  <AGUIPanel
    ref="fullscreenEl"
    class="panel-scene flex-1 relative" h="full" w="full"
  >
    <div
      class="fullscreen-btn inline-flex size-5 cursor-pointer items-center right-0 top-0 justify-center absolute z-1"
      @click="toggleFullscreen"
    >
      <div
        :class="isFullscreen
          ? 'i-ri-fullscreen-exit-line'
          : 'i-ri-fullscreen-line'"
      />
    </div>

    <AGUITabs
      v-model="curTab"
      :list="tabList"
      default-value="game"
      :unmount-on-hide="false"
      @change="changeTab"
    >
      <!-- avoid canvas display -->
      <AGUITabPanel v-show="curTab === 'game'" value="game">
        <AdvGamePreview />
      </AGUITabPanel>

      <AGUITabPanel v-if="curTab === 'character'" value="character">
        <AEWindowCharacter />
      </AGUITabPanel>

      <AGUITabPanel value="audio">
        <AEAudioPanel />
      </AGUITabPanel>

      <AGUITabPanel v-show="curTab === 'flow-editor'" value="flow-editor">
        <AdvFlowEditor />
      </AGUITabPanel>

      <AGUITabPanel v-if="curTab === 'dashboard'" value="dashboard">
        <AIDashboardView />
      </AGUITabPanel>

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
