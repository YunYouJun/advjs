<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  // DialogTrigger,
} from 'reka-ui'

defineProps<{
  contentClass: string
}>()

const open = defineModel('open', {
  default: false,
  type: Boolean,
  required: true,
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <!-- <DialogTrigger>
      <slot name="trigger" />
    </DialogTrigger> -->

    <DialogPortal>
      <DialogOverlay />

      <DialogContent :class="contentClass" as-child>
        <!-- <slot name="title">
          <DialogTitle />
        </slot>
        <DialogDescription /> -->
        <DialogClose>
          <slot name="close" />
        </DialogClose>

        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
