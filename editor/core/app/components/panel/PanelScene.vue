<script lang="ts" setup>
import { useFullscreen, useStorage } from '@vueuse/core'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Game', key: 'game', icon: 'i-ri-gamepad-line' },
  { title: 'Character', key: 'character', icon: 'i-ri-user-line' },
  { title: 'Audio', key: 'audio', icon: 'i-ri-music-line' },
  { title: 'Flow Editor', key: 'flow-editor', icon: 'i-ri-flow-chart' },
  // { title: 'Node Editor', key: 'node-editor', icon: 'i-ri-node-tree' },
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
  { title: 'Asset Store', key: 'asset-store', icon: 'i-ri-store-line' },
  // { title: 'Map Editor', key: 'map-editor', icon: 'i-ri-map-line' },
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
    class="panel-scene relative flex-1" h="full" w="full"
  >
    <div
      class="fullscreen-btn absolute right-0 top-0 z-1 size-5 inline-flex cursor-pointer items-center justify-center"
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
      @change="changeTab"
    >
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
        <!-- <AdvFlowEditor /> -->
      </AGUITabPanel>

      <AGUITabPanel v-show="curTab === 'scene'" h="full" :unmount="false" relative value="scene">
        <SceneToolbar absolute top-0 w-full />
        <SceneCanvas />
      </AGUITabPanel>

      <!-- <AGUITabPanel v-show="curTab === 'node-editor'">
        <NodeEditor />
      </AGUITabPanel> -->

      <!-- <AGUITabPanel>
        <MapEditor />
      </AGUITabPanel> -->

      <!-- <AGUITabPanel>
        <NodeEditor />
      </AGUITabPanel> -->

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
