<script lang="ts" setup>
const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-line' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-line' },
])
</script>

<template>
  <div absolute bottom-0 left-0 h="1/3" w="3/4">
    <AGUIPanel>
      <AGUITabs :list="tabList">
        <AGUITabPanel>
          Project
        </AGUITabPanel>
        <AGUITabPanel>
          Console
        </AGUITabPanel>
        <slot />
      </AGUITabs>
    </AGUIPanel>
  </div>
</template>
