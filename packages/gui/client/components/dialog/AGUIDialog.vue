<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  // DialogTrigger,
} from 'reka-ui'

defineProps<{
  title: string
  description?: string

  contentClass?: string
}>()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="data-[state=open]:animate-overlayShow fixed inset-0 z-99 bg-black/50" />
      <DialogContent
        class="data-[state=open]:animate-contentShow fixed left-[50%] top-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-lg bg-dark-300 shadow-xl focus:outline-none"
        flex="~ col"
        :class="contentClass || 'w-4xl h-md'"
        :aria-describedby="description"
        :aria-hidden="!open"
      >
        <div class="relative h-7 flex items-center justify-center bg-dark-50 shadow">
          <DialogTitle
            v-if="title"
            class="text-13px font-bold op-60"
          >
            {{ title }}
          </DialogTitle>
          <div class="agui-dialog--action absolute bottom-0 left-0 top-0 inline-flex items-center gap-1 px-2">
            <DialogClose
              aria-label="Close"
              class="size-3.5 inline-flex cursor-pointer items-center justify-center rounded-full bg-red-500 text-transparent hover:text-white/80 focus:outline-none"
            >
              <div aria-hidden="true" i-ri-close-line />
            </DialogClose>
          </div>
        </div>

        <DialogDescription
          v-if="description"
          class="text-mauve11 mb-5 mt-[10px] text-sm leading-normal"
        >
          {{ description }}
        </DialogDescription>

        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
