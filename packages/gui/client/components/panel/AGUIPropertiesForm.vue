<script lang="ts" setup>
import type { AGUIPropertiesPanelProps } from './types'
import { useId } from 'vue'
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
const uid = useId()
</script>

<template>
  <AGUIForm>
    <template
      v-for="(property, index) in properties"
      :key="property.name"
    >
      <hr v-if="property.type === 'divider'" class="agui-properties-divider">
      <AGUIFormItem
        v-else
        :key="property.name"
        :label="property.name"
        :description="property.description"
        :for="['slider', 'number-field', 'number-slider', 'input', 'number'].includes(property.type) ? `${uid}-${index}` : undefined"
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
          :label="property.name"
          :disabled="property.disabled"
        />
        <AGUISlider
          v-else-if="property.type === 'slider'" :id="`${uid}-${index}`" v-model="property.object[property.key]"
          :label="property.name"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUINumberField
          v-else-if="property.type === 'number-field'" :id="`${uid}-${index}`" v-model="property.object[property.key]"
          :label="property.name"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUINumberSlider
          v-else-if="property.type === 'number-slider'" :id="`${uid}-${index}`" v-model="property.object[property.key]"
          :label="property.name"
          class="w-full"
          :min="property.min"
          :max="property.max"
          :step="property.step"
          :disabled="property.disabled"
        />
        <AGUIInput
          v-else-if="property.type === 'input'" :id="`${uid}-${index}`"
          v-model="property.object[property.key]"
          class="w-full"
          :disabled="property.disabled"
        />
        <AGUIInputNumber
          v-else-if="property.type === 'number'" :id="`${uid}-${index}`"
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
          v-else-if="property.type === 'vector'" v-model="property.object[property.key]"
          :label="property.name"
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

<style lang="scss">
.agui-properties-divider {
  margin-block: 8px;
  border: 0;
  border-top: 1px solid var(--agui-c-divider);
}
</style>
