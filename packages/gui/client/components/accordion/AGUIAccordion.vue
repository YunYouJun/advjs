<script lang="ts" setup>
import type { AccordionRootProps } from 'radix-vue'
import { AccordionRoot } from 'radix-vue'
import AGUIAccordionItem from './AGUIAccordionItem.vue'
import './styles.scss'

import type { AGUIAccordionProps } from './types'

withDefaults(
  defineProps<{
    items?: AGUIAccordionProps[]
  } & Partial<AccordionRootProps>>(),
  {
    type: 'single',
  },
)
</script>

<template>
  <AccordionRoot
    class="AccordionRoot"
    collapsible
    :type="type"
    v-bind="$props"
  >
    <template v-if="items">
      <template v-for="item in items" :key="item.title">
        <AGUIAccordionItem :item="item" />
      </template>
    </template>
    <slot />
  </AccordionRoot>
</template>
