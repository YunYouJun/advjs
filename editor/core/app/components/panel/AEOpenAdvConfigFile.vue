<script setup lang="ts">
// import { ref } from 'vue'

const fileStore = useFileStore()

// const files = ref([])
// const autoUpload = ref(false)
// function formatResponse(res: any) {
//   if (!res) {
//     return { status: 'fail', error: '上传失败，原因：文件过大或网络不通' }
//   }
//   return res
// }
</script>

<template>
  <!-- <div class="my-4">
    <t-upload
      v-model="files"
      :auto-upload="autoUpload"
      theme="file"
      :data="{ extra_data: 123, file_name: 'certificate' }"
      :abridge-name="[10, 8]"
      :format-response="formatResponse"
      draggable
      action="https://service-bv448zsw-1257786608.gz.apigw.tencentcs.com/api/upload-demo"
    />
  </div> -->

  <div class="w-full flex items-center justify-evenly">
    <div
      class="inline-flex flex-col cursor-pointer items-center gap-2"
      @click="fileStore.openAdvConfigFile"
    >
      <div class="glow-icon text-7xl">
        <div
          class="i-vscode-icons:file-type-jsonld"
        />
      </div>
      <div class="text-sm op-50">
        Open Local ADV Config File
      </div>
    </div>

    <div
      class="inline-flex flex-col cursor-pointer items-center gap-2"
      @click="fileStore.onlineAdvConfigFileDialogOpen = true"
    >
      <div class="glow-icon text-7xl">
        <div
          class="i-vscode-icons:file-type-aspx"
        />
      </div>
      <div class="text-sm op-50">
        Open Online ADV Config File
      </div>
    </div>
  </div>
</template>

<style scoped>
.glow-icon {
  will-change: filter;
  transition: filter 300ms;

  &:hover {
    filter: drop-shadow(0 0 1rem rgba(252, 171, 49, 0.9));
  }
}
</style>
