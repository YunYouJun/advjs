<script lang="ts" setup>
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-line' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-line' },
])
</script>

<template>
  <AGUIDemoBlock :in-panel="false" title="Tabs Demo">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <div p="4">
          Project
        </div>
      </AGUITabPanel>
      <AGUITabPanel>
        <div p="4">
          Console
        </div>
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIDemoBlock>
</template>
