<script setup lang="ts">
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'
import { DEFAULT_BGM_LIBRARY_URL } from '../../constants'

const onlineStore = useOnlineStore()
const fileStore = useFileStore()
const gameStore = useGameStore()
const audioStore = useAudioStore()
const id = useId()

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
    v-model:open="fileStore.onlineAdvConfigFileDialogOpen"
    title="Load Online ADV Config File"
    content-class="w-720px"
  >
    <div class="flex flex-col gap-4">
      <AGUIForm padded>
        <AGUIFormItem :for="`${id}-config`" label="Online ADV Config File">
          <AGUICombobox
            :id="`${id}-config`"
            :model-value="onlineStore.onlineAdvConfigFileUrl"
            placeholder="https://.../*.adv.json"
            :options="onlineStore.onlineAdvConfigUrlOptions"
            @update:model-value="onlineStore.onlineAdvConfigFileUrl = $event"
          />
        </AGUIFormItem>
        <hr class="my-2 op-10">
        <AGUIFormItem :for="`${id}-adapter`" label="Config Adapter">
          <AGUISelect
            :id="`${id}-adapter`"
            v-model="gameStore.curAdapter"
            :options="adapterOptions"
            placeholder="Select Config Adapter"
          />
        </AGUIFormItem>
        <AGUIFormItem :for="`${id}-cdn`" label="CDN Url">
          <AGUIInput
            :id="`${id}-cdn`"
            v-model="onlineStore.cdnUrl"
            :placeholder="onlineStore.defaultCdnUrl"
          />
        </AGUIFormItem>

        <AGUIFormItem :for="`${id}-bgm`" label="BGM Library Url">
          <AGUIInput
            :id="`${id}-bgm`"
            v-model="audioStore.bgmLibraryUrl"
            :placeholder="DEFAULT_BGM_LIBRARY_URL"
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
