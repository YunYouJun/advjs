<script setup lang="ts">
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { useFullscreen } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import { useEditorLayoutState } from '../../extensions/layout-state'
import EditorRegionHost from '../extensions/EditorRegionHost.vue'

const root = shallowRef<HTMLElement>()
const { isFullscreen, toggle } = useFullscreen(root)
const app = useAppStore()
const layout = useEditorLayoutState()
watch(() => layout.state.active.main, (id) => {
  if (id === 'advjs.core/game')
    app.activeInspector = 'file'
})
</script>

<template>
  <div ref="root" class="h-full w-full">
    <EditorRegionHost region="main">
      <template #actions>
        <AGUIButton :icon="isFullscreen ? 'i-ri-fullscreen-exit-line' : 'i-ri-fullscreen-line'" title="Fullscreen" aria-label="Fullscreen" @click="toggle" />
      </template>
    </EditorRegionHost>
  </div>
</template>
