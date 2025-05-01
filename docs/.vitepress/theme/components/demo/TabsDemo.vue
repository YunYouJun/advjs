<script lang="ts" setup>
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-fill' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-fill' },
])

const curTab = ref('project')
</script>

<template>
  <AGUIDemoBlock :in-panel="false" title="Tabs Demo">
    <AGUITabs v-model="curTab" :list="tabList">
      <AGUITabPanel value="project">
        <div p="4">
          Project
        </div>
      </AGUITabPanel>
      <AGUITabPanel value="console">
        <div p="4">
          Console
        </div>
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIDemoBlock>
</template>
