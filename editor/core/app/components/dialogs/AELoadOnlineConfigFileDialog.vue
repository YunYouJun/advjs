<script setup lang="ts">
import { useAudioStore } from '../../composables/stores/useAudioStore'
import { DEFAULT_BGM_LIBRARY_URL } from '../../constants'

const onlineStore = useOnlineStore()
const fileStore = useFileStore()
const gameStore = useGameStore()
const audioStore = useAudioStore()

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
          <t-auto-complete
            v-model="onlineStore.onlineAdvConfigFileUrl"
            placeholder="https://.../*.adv.json"
            size="small"
            clearable
            :options="onlineStore.onlineAdvConfigUrlOptions"
          />
        </AGUIFormItem>
        <hr class="my-2 op-10">
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

        <AGUIFormItem label="BGM Library Url" label-class="w-1/4">
          <AGUIInput
            v-model="audioStore.bgmLibraryUrl"
            :placeholder="DEFAULT_BGM_LIBRARY_URL"
            autofocus
          />
        </AGUIFormItem>
      </AGUIForm>

      <div class="flex justify-end">
        <AGUIButton
          @click="() => {
            onlineStore.addConfigUrlOption(onlineStore.onlineAdvConfigFileUrl);
            fileStore.openOnlineAdvConfigFile({
              url: onlineStore.onlineAdvConfigFileUrl,
              adapter: gameStore.curAdapter,
            });
          }"
        >
          Open File
        </AGUIButton>
      </div>
    </div>
  </AGUIDialog>
</template>
