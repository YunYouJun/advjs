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
    <div class="mt-[25px] flex justify-end">
      <DialogClose as-child>
        <button
          class="text-green11 bg-green4 hover:bg-green5 focus:shadow-green7 text-sm leading-none font-semibold px-[15px] rounded-lg inline-flex h-[35px] items-center justify-center focus:outline-none focus:shadow-[0_0_0_2px]"
        >
          Save changes
        </button>
      </DialogClose>
    </div>
  </AGUIDialog>
</template>
