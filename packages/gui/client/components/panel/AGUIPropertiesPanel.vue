<script lang="ts" setup>
import { AGUIButton, AGUICheckbox, AGUIColorPicker, AGUINumberField, AGUISlider } from '..'
import AGUINumberSlider from '../AGUINumberSlider.vue'
import AGUIAccordionItem from '../accordion/AGUIAccordionItem.vue'

import AGUIForm from '../form/AGUIForm.vue'
import AGUIFormItem from '../form/AGUIFormItem.vue'

import AGUIInput from '../input/AGUIInput.vue'
import AGUIInputNumber from '../input/AGUIInputNumber.vue'
import AGUIInputVector from '../input/AGUIInputVector.vue'
import AGUISelect from '../select/AGUISelect.vue'

import AGUIFileHandler from '../file/AGUIFileHandler.vue'

import type { AGUIPropertiesPanelProps } from './types'

defineProps<{
  item: AGUIPropertiesPanelProps
}>()
</script>

<template>
  <AGUIAccordionItem :item="item">
    <AGUIForm>
      <template
        v-for="property in item.properties"
        :key="property.name"
      >
        <hr v-if="property.type === 'divider'" class="my-2 border-t-dark op-50 shadow">
        <AGUIFormItem
          v-else
          :key="property.name"
          :label="property.name"
        >
          <AGUIColorPicker v-if="property.type === 'color'" v-model="property.value" />
          <AGUISelect
            v-else-if="'options' in property && Array.isArray(property.options)"
            v-model="property.value"
            :options="property.options"
            :disabled="property.disabled"
          />
          <AGUISlider
            v-else-if="property.type === 'slider'"
            v-model="property.value"
            class="w-full"
            :min="property.min"
            :max="property.max"
            :step="property.step"
            :disabled="property.disabled"
          />
          <AGUINumberField
            v-else-if="property.type === 'number-field'"
            v-model="property.value"
            class="w-full"
            :min="property.min"
            :max="property.max"
            :step="property.step"
            :disabled="property.disabled"
          />
          <AGUINumberSlider
            v-else-if="property.type === 'number-slider'"
            v-model="property.value"
            class="w-full"
            :min="property.min"
            :max="property.max"
            :step="property.step"
            :disabled="property.disabled"
          />
          <AGUIInput
            v-else-if="(typeof property.value === 'string')"
            v-model="property.value" class="w-full"
            :disabled="property.disabled"
          />
          <AGUIInputNumber
            v-else-if="(typeof property.value === 'number')"
            v-model="property.value" class="w-full"
            :disabled="property.disabled"
          />
          <AGUICheckbox
            v-else-if="property.type === 'checkbox'"
            v-model:checked="property.value"
            :disabled="property.disabled"
          />
          <AGUIInputVector
            v-else-if="property.type === 'vector'" v-model="property.value"
            :disabled="property.disabled"
          />
          <AGUIButton
            v-else-if="property.type === 'button'"
            class="w-full"
            :title="property.title"
            @click="property.onClick?.()"
          >
            {{ property.label }}
          </AGUIButton>
          <AGUIFileHandler
            v-else-if="property.type === 'file'"
            class="w-full"
            :disabled="property.disabled"
            :on-file-change="property.onFileChange"
          />
        </AGUIFormItem>
      </template>
    </AGUIForm>
  </AGUIAccordionItem>
</template>
