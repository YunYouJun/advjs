<template>
  <div col="span-5" class="adv-menu-item--label justify-center" text="2xl">
    <label :for="item.label" font="bold serif">{{ item.label }}</label>
  </div>
  <div col="span-7" class="adv-menu-item--container flex items-center" p="x-2">
    <template v-if="item.type">
      <AdvCheckbox v-if="item.type === 'Checkbox'" :props="item.props" />
      <AdvRadioGroup v-if="item.type === 'RadioGroup'" :props="item.props" />
      <AdvSelect v-else-if="item.type === 'Select'" :props="item.props" />
      <!-- eslint-disable-next-line vue/no-mutating-props -->
      <AdvSlider v-else-if="item.type === 'Slider'" v-bind="item.props" v-model="item.props.modelValue.value" />
    </template>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import type { AdvMenuItemKeys, AdvMenuItemProps } from '@advjs/theme-default'

withDefaults(defineProps<{
  // todo optimize
  item: AdvMenuItemProps<AdvMenuItemKeys, any>
}>(), {
  item: () => {
    const defaultMenuItemProps: AdvMenuItemProps = {
      label: 'Label',
      type: 'Checkbox',
      props: {
        checked: false,
      },
    }
    return defaultMenuItemProps
  },
})
</script>

<style lang="scss">
.adv-menu-item--label,
.adv-menu-item--container {
  display: inline-flex;
  align-items: center;
  animation: advFadeIn var(--adv-animation-duration);
}
</style>
