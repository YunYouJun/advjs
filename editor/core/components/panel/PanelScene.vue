<script lang="ts" setup>
const tabList = ref([
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
  { title: 'Asset Store', key: 'asset-store', icon: 'i-ri-store-line' },
  { title: 'Node Editor', key: 'node-editor', icon: 'i-ri-node-tree' },
])
</script>

<template>
  <AGUIPanel class="panel-scene flex-1" h="full" min-w="300px">
    <AGUITabs :list="tabList" :default-index="2">
      <AGUITabPanel h="full" :unmount="false" relative>
        <SceneToolbar absolute top-0 w-full />
        <SceneToolkit />
        <SceneCanvas />
      </AGUITabPanel>

      <AGUITabPanel>
        Console
      </AGUITabPanel>

      <AGUITabPanel h="full">
        <NodeEditor />
      </AGUITabPanel>

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
