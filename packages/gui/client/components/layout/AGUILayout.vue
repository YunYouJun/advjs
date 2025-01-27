<script lang="ts" setup>
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

function onResize(e: { size: number }[]) {
  if (Array.isArray(e)) {
    const children = props.layout.children
    e.forEach((item, i) => {
      if (children)
        children[i].size = item.size
    })
  }
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
