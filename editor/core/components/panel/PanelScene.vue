<script lang="ts" setup>
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
  { title: 'Asset Store', key: 'asset-store', icon: 'i-ri-store-line' },
  { title: 'Map Editor', key: 'map-editor', icon: 'i-ri-map-line' },
  { title: 'Node Editor', key: 'node-editor', icon: 'i-ri-node-tree' },
])

const curTab = useStorage('cur-scene-tab', 0)

function changeTab(index: number) {
  curTab.value = index
}
</script>

<template>
  <AGUIPanel
    class="panel-scene flex-1" h="full" w="full"
  >
    <AGUITabs
      :selected-index="curTab"
      :list="tabList"
      :default-index="2"
      @change="changeTab"
    >
      <AGUITabPanel h="full" :unmount="false" relative>
        <SceneToolbar absolute top-0 w-full />
        <SceneCanvas v-show="curTab === 0" />
      </AGUITabPanel>

      <AGUITabPanel>
        <!-- <NodeEditor /> -->
      </AGUITabPanel>

      <AGUITabPanel>
        <MapEditor />
      </AGUITabPanel>

      <AGUITabPanel>
        <!-- <NodeEditor /> -->
      </AGUITabPanel>

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
