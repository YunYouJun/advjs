<script lang="ts" setup>
import { ToolbarButton, ToolbarRoot, ToolbarToggleGroup } from 'reka-ui'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Story Line', key: 'story-line', icon: 'i-ri-git-commit-line' },
  { title: 'Characters', key: 'characters', icon: 'i-ri-group-line' },
])
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList" default-value="ae-story-line">
      <AGUITabPanel class="ae-story-line h-full flex flex-col" value="ae-story-line">
        <ToolbarRoot class="flex items-center justify-center border-b border-b-stone-300 p-1 dark:border-b-dark-300">
          <ToolbarToggleGroup type="multiple" />
          <AGUIInput class="flex flex-grow" placeholder="Search" />
          <ToolbarButton
            class="ml-1"
          >
            <AGUIIconButton size="mini" icon="i-ri-search-line" />
          </ToolbarButton>
        </ToolbarRoot>

        <div class="flex flex-1 overflow-auto" style="height: calc(100% - 28px - 1px)">
          <AEViewStoryLine class="w-full" />
        </div>
      </AGUITabPanel>

      <AGUITabPanel class="h-full flex flex-col" value="ae-characters">
        <div class="flex flex-1 overflow-auto" style="height: calc(100% - 28px - 1px)">
          <AEViewCharacters class="w-full" />
        </div>
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
