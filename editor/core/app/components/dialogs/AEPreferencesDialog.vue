<script setup lang="ts">
import type { Trees } from '@advjs/gui'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

const { t } = useI18n()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const currentTab = ref({ name: 'Interface' })

const treeData = computed<Trees>(() => [
  { name: t('preferences.interface') },
])
</script>

<template>
  <AGUIDialog v-model:open="open" :title="t('preferences.title')">
    <div class="h-full w-full flex flex-1">
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
          class="w-1px bg-black"
        />
        <SplitterPanel :default-size="70" class="p-2">
          <AEPreferencesInterfaceTab />
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </AGUIDialog>
</template>
