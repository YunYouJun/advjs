<script lang="ts" setup>
import AGUIAccordionItem from '../accordion/AGUIAccordionItem.vue'

import AGUIForm from '../form/AGUIForm.vue'
import AGUIFormItem from '../form/AGUIFormItem.vue'
import type { AGUIPropertiesPanelProps } from './types'

defineProps<{
  item: AGUIPropertiesPanelProps
}>()
</script>

<template>
  <AGUIAccordionItem :item="item">
    <AGUIForm>
      <AGUIFormItem v-for="property in item.properties" :key="property.name" :label="property.name">
        <AGUIInputVector v-model="property.value" />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIAccordionItem>
</template>
