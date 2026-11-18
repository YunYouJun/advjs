<script setup lang="ts">
defineProps<{
  for?: string
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
      <component
        :is="$props.for ? 'label' : 'div'"
        v-if="label"
        :for="$props.for"
        class="agui-label label"
        :class="labelClass"
        :title="description"
      >
        {{ label }}
        <slot name="after-label" />
      </component>
    </slot>
    <div class="agui-form-item__control value">
      <slot />
      <div v-if="$slots.description" class="agui-form-item__description">
        <slot name="description" />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.agui-label {
  font-family: var(--agui-font-family-ui);
  font-size: var(--agui-font-size-body);
  color: var(--agui-c-label);
}

.agui-form-item {
  display: grid;
  grid-template-columns: var(--agui-form-columns);
  column-gap: var(--agui-form-column-gap);
  row-gap: var(--agui-form-label-gap);
  align-items: center;
  min-width: 0;
  min-height: var(--agui-control-height);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);

  > .agui-label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--agui-form-label-gap);
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  > .agui-form-item__control {
    min-width: 0;

    &:only-child {
      grid-column: 1 / -1;
    }
  }

  &--top {
    grid-template-columns: minmax(0, 1fr);

    > .agui-label {
      justify-content: flex-start;
      text-align: left;
    }
  }
}

.agui-form-item__description {
  margin-top: var(--agui-form-label-gap);
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-body);
  overflow-wrap: anywhere;
}

@container agui-properties (max-width: 240px) {
  .agui-form-item {
    grid-template-columns: minmax(0, 1fr);

    > .agui-label {
      justify-content: flex-start;
      text-align: left;
    }
  }
}
</style>
