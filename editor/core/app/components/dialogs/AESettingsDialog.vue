<script setup lang="ts">
import { DialogClose } from 'reka-ui'

const dialogStore = useDialogStore()
</script>

<template>
  <AGUIDialog v-model:open="dialogStore.settingsDialogOpen" title="Settings">
    <AESettingsCOSTab />
    <div class="mt-[25px] flex justify-end">
      <DialogClose as-child>
        <button
          class="text-green11 h-[35px] inline-flex items-center justify-center rounded-lg bg-green4 px-[15px] text-sm font-semibold leading-none hover:bg-green5 focus:shadow-[0_0_0_2px] focus:shadow-green7 focus:outline-none"
        >
          Save changes
        </button>
      </DialogClose>
    </div>
  </AGUIDialog>
</template>
