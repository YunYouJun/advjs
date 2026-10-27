<script lang="ts" setup>
import type { AGUIAccordionProps } from './types'
import { usePreferredReducedMotion } from '@vueuse/core'
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'reka-ui'
import './styles.scss'

defineProps<{
  item: AGUIAccordionProps
}>()

const reducedMotion = usePreferredReducedMotion()
</script>

<template>
  <AccordionItem
    v-slot="{ open }"
    class="AccordionItem"
    :value="item.value || item.title"
    :collapsible="item.collapsible"
  >
    <AccordionHeader class="AccordionHeader">
      <AccordionTrigger class="AccordionTrigger">
        <div class="AccordionChevron i-ep-caret-right mx-1" />
        <slot name="icon">
          <div :class="item.icon" class="AccordionIcon text-xs mr-1" />
        </slot>
        <slot name="title">
          <span class="text-xs">{{ item.title }}</span>
        </slot>
        <slot name="trigger" />
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent :key="Number(!open && reducedMotion === 'reduce')" class="AccordionContent">
      <slot name="content">
        <div class="AccordionContentText">
          <slot />
        </div>
      </slot>
    </AccordionContent>
  </AccordionItem>
</template>
