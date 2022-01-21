<template>
  <div col="span-5" class="adv-menu-item--label justify-center" text="2xl">
    <label :for="item.label" font="bold serif">{{ item.label }}</label>
  </div>
  <div col="span-7" class="adv-menu-item--container flex items-center" p="x-2">
    <template v-if="item.type">
      <AdvCheckbox v-if="item.type === 'Checkbox'" :checked="item.props.checked" @click="item.props.click" />
      <AdvRadioGroup v-if="item.type === 'RadioGroup'" :checked="item.props.checked" :options="item.props.options" :on-click="item.props.onClick" />
      <AdvSelect v-else-if="item.type === 'Select'" v-bind="item.props" />
    </template>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/theme-default'

withDefaults(defineProps<{
  item: AdvMenuItemProps
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
