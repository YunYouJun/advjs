<script setup lang="ts">
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { useFullscreen } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import { useEditorLayoutState } from '../../extensions/layout-state'
import EditorRegionHost from '../extensions/EditorRegionHost.vue'

const root = shallowRef<HTMLElement>()
const { isFullscreen, toggle } = useFullscreen(root)
const layout = useEditorLayoutState()
const file = useFileStore()
watch(() => file.openVersion, () => {
  layout.select('main', 'advjs.core/file')
})
</script>

<template>
  <div ref="root" class="h-full w-full">
    <EditorRegionHost region="main">
      <template #actions>
        <AGUIIconButton
          :active="isFullscreen"
          :icon="isFullscreen ? 'i-ri-fullscreen-exit-line' : 'i-ri-fullscreen-line'"
          :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
          @click="toggle"
        />
      </template>
    </EditorRegionHost>
  </div>
</template>
