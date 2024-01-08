<script lang="ts" setup>
withDefaults(defineProps<{
  label?: string
  value?: string | number | boolean
  checked?: boolean
  disabled?: boolean
}>(), {
  label: undefined,
  value: undefined,
  checked: false,
  disabled: false,
})

const emit = defineEmits([
  'change',
  'update:checked',
])

function onChange(e: Event) {
  const target = e.target as HTMLInputElement
  emit('change', target.checked)
  emit('update:checked', target.checked)
}
</script>

<template>
  <input
    v-if="!label"
    class="agui-checkbox" type="checkbox"
    :value="value" :checked="checked" :disabled="disabled"
    @change="onChange"
  >

  <label v-else class="agui-checkbox-container" :title="label">
    <input
      :value="value"
      :checked="checked"
      class="input"
      type="checkbox"
      :disabled="disabled"
      @change="onChange"
      @click.stop="() => {}"
    >
    <slot>
      <template v-if="label">
        <span class="label">
          {{ label }}
        </span>
      </template>
    </slot>
  </label>
</template>

<style lang="scss">
.agui-checkbox-container {
  display: flex;
  gap: 2px;
  color: white;
  align-items: center;
  user-select: none;
  font:
    12px system-ui,
    sans-serif;
  cursor: pointer;

  margin: 2px;

  .label {
    margin-left: 2px;
    line-height: 1;
  }

  .input {
    outline: none;
    appearance: none;
    background: #545454;
    border: 1px solid #3d3d3d;
    border-radius: 3px;
    box-shadow: 0 1px 1px rgba(black, 0.2);
    width: 14px;
    height: 14px;
    margin: 0;

    &:hover {
      background: #656565;
      border-color: #464646;
    }
    &:checked {
      background: #4772b3 var(--b-icon-checkbox) no-repeat center center;
    }
    &:focus-visible {
      border-color: #4772b3;
      &:checked {
        border-color: white;
      }
    }

    &:disabled {
      &:hover {
        background: #545454;
        border-color: #3d3d3d;
      }
      &:checked {
        background: #545454 var(--b-icon-checkbox) no-repeat center center;
      }
    }
  }
}
</style>
