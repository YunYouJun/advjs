<script setup lang="ts">
import type { TreeNode, Trees } from '@advjs/gui'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

const { t } = useI18n()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const selectedTab = ref('theme')

const treeData = computed<Trees>(() => [
  { id: 'theme', name: t('preferences.theme') },
  { id: 'interface', name: t('preferences.interface') },
])

const currentTab = computed<TreeNode>({
  get: () => treeData.value.find(tab => tab.id === selectedTab.value)!,
  set: (tab) => {
    selectedTab.value = tab.id === 'interface' ? 'interface' : 'theme'
  },
})
</script>

<template>
  <AGUIDialog v-model:open="open" :title="t('preferences.title')">
    <div class="flex flex-1 h-full w-full">
      <SplitterGroup
        direction="horizontal"
        class="flex-grow"
      >
        <SplitterPanel
          id="preferences-nav-panel"
          :min-size="20"
          :default-size="30"
          class="flex items-center justify-center"
        >
          <AGUITree
            v-model:current-node="currentTab"
            class="h-full w-full"
            :data="treeData"
          />
        </SplitterPanel>
        <SplitterResizeHandle
          class="bg-$agui-c-divider w-1px"
        />
        <SplitterPanel :default-size="70" class="p-2">
          <AEPreferencesThemeTab v-if="selectedTab === 'theme'" />
          <AEPreferencesInterfaceTab v-else />
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </AGUIDialog>
</template>
