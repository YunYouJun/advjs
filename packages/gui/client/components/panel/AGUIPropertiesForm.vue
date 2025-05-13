<script lang="ts" setup>
import type { AGUIPropertiesPanelProps } from './types'
import { AGUIButton, AGUICheckbox, AGUIColorPicker, AGUINumberField, AGUISlider } from '..'

import AGUINumberSlider from '../AGUINumberSlider.vue'
import AGUIFileHandler from '../file/AGUIFileHandler.vue'

import AGUIForm from '../form/AGUIForm.vue'
import AGUIFormItem from '../form/AGUIFormItem.vue'
import AGUIInput from '../input/AGUIInput.vue'
import AGUIInputNumber from '../input/AGUIInputNumber.vue'

import AGUIInputVector from '../input/AGUIInputVector.vue'

import AGUISelect from '../select/AGUISelect.vue'

defineProps<{
  properties: AGUIPropertiesPanelProps['properties']
}>()
</script>

<template>
  <AGUIForm>
    <template
      v-for="property in properties"
      :key="property.name"
    >
      <hr v-if="property.type === 'divider'" class="my-2 border-t-dark op-50 shadow">
      <AGUIFormItem
        v-else
        :key="property.name"
        :label="property.name"
        :description="property.description"
      >
        <template v-if="property.showKey" #after-label>
          <span class="text-xs op-50">
            {{ property.key }}
          </span>
        </template>

        <AGUIColorPicker
          v-if="property.type === 'color'"
          v-model="property.object[property.key]"
          :rgb-scale="property.rgbScale"
        />
        <AGUISelect
          v-else-if="'options' in property && Array.isArray(property.options)"
          v-model="property.object[property.key]"
          :options="property.options"
          :disabled="property.disabled"
        />
        <AGUISlider
          v-else-if="property.type === 'slider'"
          v-model="property.object[property.key]"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUINumberField
          v-else-if="property.type === 'number-field'"
          v-model="property.object[property.key]"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUINumberSlider
          v-else-if="property.type === 'number-slider'"
          v-model="property.object[property.key]"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUIInput
          v-else-if="property.type === 'input'"
          v-model="property.object[property.key]"
          class="w-full"
          :disabled="property.disabled"
        />
        <AGUIInputNumber
          v-else-if="property.type === 'number'"
          v-model="property.object[property.key]"
          class="w-full"
          :disabled="property.disabled"
        />
        <AGUICheckbox
          v-else-if="property.type === 'checkbox'"
          v-model:checked="property.object[property.key]"
          :disabled="property.disabled"
        />
        <AGUIInputVector
          v-else-if="property.type === 'vector'"
          v-model="property.object[property.key]"
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
          v-model="property.value"
          class="w-full"
          :disabled="property.disabled"
          :on-file-change="property.onFileChange"
        />
      </AGUIFormItem>
    </template>
  </AGUIForm>
</template>
