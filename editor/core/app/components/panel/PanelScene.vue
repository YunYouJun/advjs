<script lang="ts" setup>
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Flow Editor', key: 'flow-editor', icon: 'i-ri-flow-chart' },
  { title: 'Node Editor', key: 'node-editor', icon: 'i-ri-node-tree' },
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
  { title: 'Asset Store', key: 'asset-store', icon: 'i-ri-store-line' },
  { title: 'Map Editor', key: 'map-editor', icon: 'i-ri-map-line' },
])

const curTab = useStorage('cur-scene-tab', 'node-editor')
/**
 * change tab key
 */
function changeTab(index: number) {
  curTab.value = tabList.value[index]?.key
}

const selectedIndex = computed(() => {
  return tabList.value.findIndex(tab => tab.key === curTab.value)
})
</script>

<template>
  <AGUIPanel
    class="panel-scene flex-1" h="full" w="full"
  >
    <AGUITabs
      :selected-index="selectedIndex"
      :list="tabList"
      :default-index="2"
      @change="changeTab"
    >
      <AGUITabPanel v-show="curTab === 'flow-editor'">
        <AdvFlowEditor />
      </AGUITabPanel>

      <AGUITabPanel v-show="curTab === 'scene'" h="full" :unmount="false" relative>
        <SceneToolbar absolute top-0 w-full />
        <SceneCanvas />
      </AGUITabPanel>

      <!-- <AGUITabPanel v-show="curTab === 'node-editor'">
        <NodeEditor />
      </AGUITabPanel> -->

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
