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
      class="agui-checkbox"
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
  gap: var(--agui-space-2);
  color: var(--agui-c-text-1);
  align-items: center;
  user-select: none;
  font: var(--agui-font-size-body) / var(--agui-line-height) var(--agui-font-family-ui);
  cursor: pointer;
  min-height: var(--agui-control-height);

  min-width: 0;
  margin: 0;

  .label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .agui-checkbox {
    flex-shrink: 0;
  }
}
</style>
