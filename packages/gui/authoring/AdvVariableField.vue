<script setup lang="ts">
import type { PreviewScalar, PreviewVariable } from './preview-types'
import { computed, shallowRef, useId, watch } from 'vue'

const props = defineProps<{ variable: PreviewVariable, disabled?: boolean, labels?: { unset?: string, invalidNumber?: string } }>()
const emit = defineEmits<{ change: [value: PreviewScalar | undefined] }>()
defineSlots<{
  boolean?: (props: { variable: PreviewVariable, id: string, disabled: boolean, change: (value: boolean) => void }) => any
  select?: (props: { variable: PreviewVariable, value: string, options: { value: string, label: string }[], disabled: boolean, change: (value: string) => void }) => any
  unset?: (props: { variable: PreviewVariable, disabled: boolean, clear: () => void, label: string }) => any
}>()
const id = useId()
const invalid = shallowRef(false)
const draft = shallowRef(String(props.variable.value ?? ''))
const blocked = computed(() => !!props.disabled || !!props.variable.readonly)
const options = computed(() => [
  ...(props.variable.optional ? [{ value: '', label: props.labels?.unset ?? 'Unset' }] : []),
  ...(props.variable.options ?? (props.variable.type === 'boolean' ? [{ value: false, label: 'false' }, { value: true, label: 'true' }] : [])).map((option, index) => ({ value: String(index), label: option.label })),
])
const choices = computed(() => props.variable.options ?? (props.variable.type === 'boolean' ? [{ value: false, label: 'false' }, { value: true, label: 'true' }] : []))
const selected = computed(() => {
  const index = choices.value.findIndex(option => Object.is(option.value, props.variable.value))
  return index === -1 ? '' : String(index)
})
const selectControl = computed(() => !!props.variable.options?.length || (props.variable.type === 'boolean' && props.variable.optional))
watch([() => props.variable.id, () => props.variable.value], () => {
  draft.value = String(props.variable.value ?? '')
  invalid.value = false
})
function change(value: PreviewScalar | undefined) {
  if (!blocked.value)
    emit('change', value)
}
function select(value: string) {
  if (value === '' && props.variable.optional) {
    change(undefined)
  }
  else {
    const option = choices.value.find((_, index) => String(index) === value)
    if (option)
      change(option.value)
  }
}
function input(event: Event) {
  const element = event.target as HTMLInputElement
  draft.value = element.value
  if (props.variable.type !== 'number') {
    change(element.value)
    return
  }
  const value = element.valueAsNumber
  invalid.value = element.value === '' || !Number.isFinite(value) || (props.variable.min !== undefined && value < props.variable.min) || (props.variable.max !== undefined && value > props.variable.max)
  if (!invalid.value)
    change(value)
}
</script>

<template>
  <div class="variable-field" :data-preview-variable="variable.id">
    <dl v-if="variable.readonly">
      <div>
        <dt>{{ variable.label }}</dt><dd :data-value="String(variable.value)">
          {{ String(variable.value) }}
        </dd>
      </div>
    </dl>
    <div v-else-if="variable.type === 'boolean' && !variable.optional && !variable.options?.length" class="toggle-row">
      <label :for="id">{{ variable.label }}</label>
      <slot :id="id" name="boolean" :variable="variable" :disabled="blocked" :change="change">
        <input :id="id" type="checkbox" :aria-label="variable.controlLabel ?? variable.label" :checked="variable.value === true" :disabled="blocked" @change="change(($event.target as HTMLInputElement).checked)">
      </slot>
    </div>
    <slot v-else-if="selectControl" name="select" :variable="variable" :value="selected" :options="options" :disabled="blocked" :change="select">
      <label class="field" :for="id">{{ variable.label }}<select :id="id" :value="selected" :disabled="blocked" @change="select(($event.target as HTMLSelectElement).value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    </slot>
    <template v-else>
      <label class="field" :for="id">{{ variable.label }}<input :id="id" :type="variable.type === 'number' ? 'number' : 'text'" :value="draft" :min="variable.min" :max="variable.max" :step="variable.step ?? 'any'" :disabled="blocked" :aria-invalid="invalid" :aria-describedby="invalid ? `${id}-error` : undefined" @input="draft = ($event.target as HTMLInputElement).value" @change="input"></label>
      <p v-if="invalid" :id="`${id}-error`" class="variable-error">
        {{ labels?.invalidNumber ?? 'Enter a finite number within the allowed range.' }}
      </p>
      <slot v-if="variable.optional" name="unset" :variable="variable" :disabled="blocked || variable.value === undefined" :clear="() => change(undefined)" :label="labels?.unset ?? 'Unset'">
        <button type="button" :disabled="blocked || variable.value === undefined" @click="change(undefined)">
          {{ labels?.unset ?? 'Unset' }} {{ variable.label }}
        </button>
      </slot>
    </template>
  </div>
</template>

<style scoped>
.variable-field {
  min-width: 0;
}
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
label,
dt,
dd {
  overflow-wrap: anywhere;
}
input,
select {
  max-width: 100%;
  box-sizing: border-box;
}
</style>
