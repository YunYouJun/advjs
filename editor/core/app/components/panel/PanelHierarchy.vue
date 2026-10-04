<script lang="ts" setup>
import { ToolbarButton, ToolbarRoot, ToolbarToggleGroup } from 'reka-ui'
import { computed } from 'vue'

const { t } = useI18n()
const tabList = computed(() => [
  { title: t('panels.storyLine'), key: 'story-line', icon: 'i-ri-git-commit-line' },
  { title: t('panels.characters'), key: 'characters', icon: 'i-ri-group-line' },
])
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList" default-value="ae-story-line">
      <AGUITabPanel class="ae-story-line flex flex-col h-full" value="ae-story-line">
        <ToolbarRoot class="p-1 border-b border-b-stone-300 flex items-center justify-center dark:border-b-dark-300">
          <ToolbarToggleGroup type="multiple" />
          <AGUIInput class="flex flex-grow" :placeholder="$t('common.search')" />
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

      <AGUITabPanel class="flex flex-col h-full" value="ae-characters">
        <div class="flex flex-1 overflow-auto" style="height: calc(100% - 28px - 1px)">
          <AEViewCharacters class="w-full" />
        </div>
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
