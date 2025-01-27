<script lang="ts" setup>
import { ref } from 'vue'
import { ToolbarButton, ToolbarRoot, ToolbarToggleGroup } from 'radix-vue'

const tabList = ref([
  { title: 'Hierarchy', key: 'hierarchy', icon: 'i-ri-node-tree' },
])
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <ToolbarRoot class="flex items-center justify-center p-1">
          <ToolbarToggleGroup />
          <AGUIInput class="flex flex-grow" placeholder="Search" />
          <ToolbarButton
            class="ml-1"
          >
            <AGUIIconButton size="mini" icon="i-ri-search-line" />
          </ToolbarButton>
        </ToolbarRoot>
        <HierarchyView />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
