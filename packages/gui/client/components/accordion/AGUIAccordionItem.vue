<script lang="ts" setup>
import type { AGUIAccordionProps } from './types'
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'reka-ui'
import { shallowRef } from 'vue'
import AGUIDisclosureChevron from '../disclosure/AGUIDisclosureChevron.vue'
import '../disclosure/disclosure.scss'
import './styles.scss'

defineProps<{
  item: AGUIAccordionProps
}>()

const contentMounted = shallowRef(false)
</script>

<template>
  <AccordionItem
    v-slot="{ open }"
    class="AccordionItem"
    :value="item.value || item.title"
    :collapsible="item.collapsible"
  >
    <AccordionHeader class="AccordionHeader">
      <AccordionTrigger class="AccordionTrigger agui-disclosure-heading">
        <AGUIDisclosureChevron class="AccordionChevron" />
        <slot name="icon">
          <span v-if="item.icon" :class="item.icon" class="AccordionIcon agui-disclosure-icon" aria-hidden="true" />
        </slot>
        <span class="agui-disclosure-title">
          <slot name="title">{{ item.title }}</slot>
        </span>
        <slot name="trigger" />
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent
      v-if="open || contentMounted"
      v-show="open"
      force-mount
      :inert="!open ? '' : undefined"
      :aria-hidden="!open || undefined"
      class="AccordionContent"
      @vue:mounted="contentMounted = true"
    >
      <slot name="content">
        <div class="AccordionContentText">
          <slot />
        </div>
      </slot>
    </AccordionContent>
  </AccordionItem>
</template>
