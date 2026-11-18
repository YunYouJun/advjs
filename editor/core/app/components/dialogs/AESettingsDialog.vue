<script setup lang="ts">
import { DialogClose } from 'reka-ui'

const open = defineModel('open', {
  type: Boolean,
  default: false,
})
</script>

<template>
  <AGUIDialog v-model:open="open" title="Settings">
    <AESettingsCOSTab />
    <div class="p-2 flex justify-end">
      <DialogClose as-child>
        <AGUIButton>
          Save changes
        </AGUIButton>
      </DialogClose>
    </div>
  </AGUIDialog>
</template>
