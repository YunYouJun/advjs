<script setup lang="ts">
import type { Trees } from '@advjs/gui'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const projectStore = useProjectStore()

const treeData = ref<Trees>([
  { name: 'Common' },
  { name: 'CDN' },
])
</script>

<template>
  <AGUIDialog v-model:open="open" title="Project Settings">
    <!-- <AESettingsCOSTab /> -->
    <div class="h-full w-full flex flex-1">
      <SplitterGroup
        direction="horizontal"
        class="flex-grow"
      >
        <SplitterPanel
          id="splitter-group-1-panel-1"
          :min-size="20"
          :default-size="30"
          class="flex items-center justify-center"
        >
          <AGUITree
            v-model:current-node="projectStore.curAdvConfigTab"
            class="h-full w-full"
            :data="treeData"
          />
        </SplitterPanel>
        <SplitterResizeHandle
          class="w-1px bg-black"
        />
        <SplitterPanel :default-size="70" class="p-2">
          <AEProjectSettingsTab :title="projectStore.curAdvConfigTab.name" />
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </AGUIDialog>
</template>
