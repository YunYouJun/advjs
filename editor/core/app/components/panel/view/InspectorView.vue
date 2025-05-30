<script lang="ts" setup>
import type { AGUIPropertiesPanelProps, Vector3 } from '@advjs/gui'
import { Toast } from '@advjs/gui'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

let count = 0

const transformObj = ref({
  position: {
    x: 0,
    y: 0,
    z: 0,
  },
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
  scale: {
    x: 0,
    y: 0,
    z: 0,
  },
})

const formData = reactive({
  input: 'test',
  inputNumber: 10,
  checkbox: true,
  select: '',
  select2: 'option1',
  slider: 10,
  numberField: 10,
  numberSlider: 10,
  vector2: {
    x: 0,
    y: 0,
  },
  vector3: {
    x: 0,
    y: 0,
    z: 0,
  },
  vector4: {
    x: 0,
    y: 0,
    z: 0,
    w: 0,
  },
  colorHex: '#0099ff',
  colorRgba: {
    r: 255,
    g: 0,
    b: 0,
    a: 1,
  },
  colorHsla: {
    h: 119,
    s: 100,
    l: 18,
    a: 1,
  },
  colorHsva: {
    h: 76,
    s: 99,
    v: 79,
    a: 1,
  },
  colorRgbScale: {
    r: 1,
    g: 0,
    b: 0,
    a: 1,
  },
  file: '',
})

const items = ref<AGUIPropertiesPanelProps[]>([
  {
    icon: 'i-mdi-axis-arrow',
    title: 'Transform',
    properties: [
      {
        type: 'vector',
        name: 'Position',
        object: transformObj,
        key: 'position',
      },
      {
        type: 'vector',
        name: 'Rotation',
        object: transformObj,
        key: 'rotation',
      },
      {
        type: 'vector',
        name: 'Scale',
        object: transformObj,
        key: 'scale',
      },
    ],
  },

  {
    icon: 'i-ri:compasses-2-fill',
    title: 'Form Example',
    properties: [
      {
        type: 'input',
        name: 'Input',
        object: formData,
        key: 'input',
      },
      {
        type: 'number',
        name: 'InputNumber',
        object: formData,
        key: 'inputNumber',
      },
      {
        type: 'checkbox',
        name: 'Checkbox',
        object: formData,
        key: 'checkbox',
      },
      {
        type: 'select',
        name: 'Select',
        options: [
          {
            label: 'Option 1',
            value: 'option1',
          },
          {
            label: 'Option 2',
            value: 'option2',
          },
        ],
        object: formData,
        key: 'select',
      },
      {
        type: 'select',
        name: 'Select',
        options: [
          {
            label: 'Option 1',
            value: 'option1',
          },
          {
            label: 'Option 2',
            value: 'option2',
          },
        ],
        object: formData,
        key: 'select2',
      },
      {
        name: 'Slider',
        type: 'slider',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'slider',
      },
      {
        name: 'Number Field',
        type: 'number-field',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'numberField',
      },
      {
        name: 'Number Slider',
        type: 'number-slider',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'numberSlider',
      },
      {
        name: 'divider',
        type: 'divider',
      },
      {
        type: 'vector',
        name: 'Vector2',
        object: formData,
        key: 'vector2',
      },
      {
        type: 'vector',
        name: 'Vector3',
        object: formData,
        key: 'vector3',
      },
      {
        type: 'vector',
        name: 'Vector4',
        object: formData,
        key: 'vector4',
      },
      {
        type: 'color',
        name: 'Color Picker Hex',
        object: formData,
        key: 'colorHex',
      },
      {
        type: 'color',
        name: 'Color Picker Rgba',
        object: formData,
        key: 'colorRgba',
      },
      {
        type: 'color',
        name: 'Color Picker Hsla',
        object: formData,
        key: 'colorHsla',
      },
      {
        type: 'color',
        name: 'Color Picker Hsva',
        object: formData,
        key: 'colorHsva',
      },
      {
        type: 'color',
        name: 'Color Picker (Rgb Scale)',
        object: formData,
        key: 'colorRgbScale',
        rgbScale: 1,
      },
      {
        type: 'button',
        name: 'Button',
        label: 'Button Label',
        title: 'Alert Test',
        onClick() {
          // alert('Button clicked!')
          Toast({
            title: 'Button clicked!',
            description: 'Button clicked!',
            type: (['default', 'info', 'success', 'warning', 'error'] as const)[count++ % 5],
          })
        },
        object: formData,
        key: 'button',
      },
      {
        type: 'file',
        name: 'Accept File',
        placeholder: 'Placeholder',
        onFileChange(file) {
          // eslint-disable-next-line no-console
          console.log(file)
        },
        object: formData,
        key: 'file',
      },
    ],
  },
])

const openItems = useStorage<string[]>('inspector:open-items', items.value.map(item => item.title))
const vector3 = ref<Vector3>({
  x: 0,
  y: 0,
  z: 0,
})
</script>

<template>
  <AGUIAccordion v-model="openItems" type="multiple">
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

        <pre>
{{ formData }}
</pre>
      </AGUIForm>
    </AGUIAccordionItem>
  </AGUIAccordion>
</template>
