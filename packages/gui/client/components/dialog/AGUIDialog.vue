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
import AGUIButton from '../button/AGUIButton.vue'

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
      <DialogOverlay class="agui-dialog-overlay" />
      <DialogContent
        class="agui-dialog-content"
        :class="contentClass || 'w-4xl h-md'"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        :aria-hidden="!open"
      >
        <header class="agui-dialog-header">
          <DialogTitle class="agui-dialog-title">
            {{ title }}
          </DialogTitle>
          <DialogClose as-child>
            <AGUIButton variant="text" icon="i-ri-close-line" aria-label="Close" title="Close" />
          </DialogClose>
        </header>

        <DialogDescription
          v-if="description"
          class="agui-dialog-description"
        >
          {{ description }}
        </DialogDescription>

        <div class="agui-dialog-body">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.agui-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: var(--agui-c-overlay);
}
.agui-dialog-content {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-border);
  border-radius: 4px;
  box-shadow: var(--agui-shadow-popup);
  font-size: 13px;
}
.agui-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 4px 0 12px;
  border-bottom: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-panel-title);
}
.agui-dialog-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.agui-dialog-description {
  margin: 0;
  padding: 8px 12px;
  color: var(--agui-c-text-2);
}
.agui-dialog-body {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: auto;
}
</style>
