<script lang="ts" setup>
const tabList = ref([
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
  { title: 'Asset Store', key: 'asset-store', icon: 'i-ri-store-line' },
])
</script>

<template>
  <AGUIPanel class="panel-scene flex-1" h="full" min-w="300px">
    <AGUITabs :list="tabList">
      <AGUITabPanel h="full" :unmount="false" relative>
        <SceneToolbar absolute top-0 w-full />
        <!-- <SceneToolkit absolute left-1 top-1 /> -->
        <SceneCanvas />
      </AGUITabPanel>
      <AGUITabPanel>
        Console
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
