<script setup lang="ts">
const onlineStore = useOnlineStore()
const fileStore = useFileStore()
const gameStore = useGameStore()

const adapterOptions = ref<{
  label: string
  value: string
  icon?: string
}[]>([
  { label: 'Default', value: 'default' },
  { label: 'Pominis', value: 'pominis' },
])
</script>

<template>
  <AGUIDialog
    v-model:open="fileStore.onlineAdvConfigFileDialogOpen" title="Load Online ADV Config File"
    content-class="w-720px"
  >
    <div class="flex flex-col gap-4">
      <AGUIForm>
        <AGUIFormItem label="Online ADV Config File" label-class="w-1/4">
          <AGUIInput
            v-model="onlineStore.onlineAdvConfigFileUrl"
            placeholder="https://.../*.adv.json"
            autofocus
          />
        </AGUIFormItem>
        <AGUIFormItem label="Config Adapter" label-class="w-1/4">
          <AGUISelect
            v-model="gameStore.curAdapter"
            :options="adapterOptions"
            placeholder="Select Config Adapter"
          />
        </AGUIFormItem>
        <AGUIFormItem label="CDN Url" label-class="w-1/4">
          <AGUIInput
            v-model="onlineStore.cdnUrl"
            :placeholder="onlineStore.defaultCdnUrl"
            autofocus
          />
        </AGUIFormItem>
      </AGUIForm>

      <div class="flex justify-end">
        <AGUIButton @click="fileStore.openOnlineAdvConfigFile(onlineStore.onlineAdvConfigFileUrl)">
          Open File
        </AGUIButton>
      </div>
    </div>
  </AGUIDialog>
</template>
