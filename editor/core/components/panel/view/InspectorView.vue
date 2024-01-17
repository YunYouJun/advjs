<script lang="ts" setup>
import { ref } from 'vue'
import type { AGUIPropertiesPanelProps, Vector3 } from '@advjs/gui'

const items = ref<AGUIPropertiesPanelProps[]>([
  {
    icon: 'i-mdi-axis-arrow',
    title: 'Transform',
    properties: [
      {
        name: 'Position',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      {
        name: 'Rotation',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      {
        name: 'Scale',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
    ],
  },
])

const defaultOpenItems = items.value.map(item => item.title).concat('test')

const vector3 = ref<Vector3>({
  x: 0,
  y: 0,
  z: 0,
})
</script>

<template>
  <AGUIAccordion type="multiple" :default-value="defaultOpenItems">
    <AGUIPropertiesPanel v-for="item in items" :key="item.title" :item="item" />
    <AGUIAccordionItem
      :item="{
        icon: 'i-ri-cloud-line',
        title: 'test',
      }"
    >
      <AGUIForm>
        <AGUIFormItem label="Default">
          <AGUIInputVector v-model="vector3" />
        </AGUIFormItem>

        <AGUIFormItem label="Default">
          <AGUICheckbox />
        </AGUIFormItem>
        <AGUIFormItem label="Checked" description="Checked Checkbox">
          <AGUICheckbox checked />
        </AGUIFormItem>
        <AGUIFormItem label="Disabled">
          <AGUICheckbox disabled />
        </AGUIFormItem>
      </AGUIForm>
    </AGUIAccordionItem>
  </AGUIAccordion>
</template>
