<script lang="ts" setup>
import type { SplitpanesResizePayload } from 'splitpanes'
import type { AGUILayoutType } from './types'
import { Pane, Splitpanes } from 'splitpanes'
import { computed } from 'vue'
import 'splitpanes/dist/splitpanes.css'

const props = defineProps<{
  layout: AGUILayoutType
}>()

function getChildrenNames(children: AGUILayoutType['children']): string[] {
  const names: string[] = []
  if (!children)
    return names
  for (const child of children) {
    names.push(child.name)
    if (child.children)
      names.push(...getChildrenNames(child.children))
  }
  return names
}

/**
 * collect all slot names from children
 */
const slotNames = computed(() => getChildrenNames(props.layout.children))

function onResize(payload: SplitpanesResizePayload) {
  const children = props.layout.children
  if (!children)
    return
  payload.panes.forEach((pane, i) => {
    children[i].size = pane.size
  })
}
</script>

<template>
  <Splitpanes :horizontal="layout.type === 'horizontal'" @resize="onResize">
    <Pane
      v-for="child in layout.children" :key="child.name"
      v-model:size="child.size"
      :max-size="child.max"
      :min-size="child.min"
    >
      <AGUILayout v-if="child.children" :layout="child">
        <template v-for="name in slotNames" :key="name" #[name]>
          <slot :name="name" />
        </template>
      </AGUILayout>

      <slot :name="child.name" />
      <slot />
    </Pane>
  </Splitpanes>
</template>
