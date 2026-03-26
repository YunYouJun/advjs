<script setup lang="ts">
defineProps<{
  label?: string
  labelClass?: string
  description?: string
  labelAlign?: 'left' | 'top'
}>()
</script>

<template>
  <div
    class="agui-form-item"
    :class="{
      'agui-form-item--top': labelAlign === 'top',
      'agui-form-item--left': labelAlign !== 'top',
    }"
  >
    <slot name="label">
      <label
        v-if="label"
        class="agui-label"
        :class="labelClass"
        :title="description"
      >
        {{ label }}
        <slot name="after-label" />
      </label>
    </slot>
    <div class="agui-form-item__control">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.agui-label {
  font-size: 12px;
  color: var(--agui-c-label, #999);
}

.agui-form-item--left {
  display: flex;
  gap: 4px;
  align-items: center;

  > .agui-label {
    width: 33%;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
  }

  > .agui-form-item__control {
    width: 67%;
    flex: 1;
    display: flex;
    align-items: center;
  }
}

.agui-form-item--top {
  display: flex;
  flex-direction: column;
  gap: 4px;

  > .agui-label {
    display: block;
  }

  > .agui-form-item__control {
    width: 100%;
    display: flex;
  }
}
</style>
