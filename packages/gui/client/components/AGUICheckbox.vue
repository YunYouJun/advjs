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
  gap: 2px;
  color: var(--agui-c-text-1);
  align-items: center;
  user-select: none;
  font:
    12px system-ui,
    sans-serif;
  cursor: pointer;
  min-height: var(--agui-control-height);

  margin: 2px;

  .label {
    margin-left: 2px;
    line-height: 1;
  }

  .agui-checkbox {
    flex-shrink: 0;
  }
}
</style>
