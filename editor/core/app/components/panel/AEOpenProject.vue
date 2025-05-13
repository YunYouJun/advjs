<script setup lang="ts">
const res = useFileSystemAccess({
  dataType: 'Text',
  types: [{
    description: 'ADV Project Entry',
    accept: {
      'application/json': ['.adv.json'],
    },
  }],
  excludeAcceptAllOption: true,
})

/**
 * create `*.adv.json` file
 */
async function createAdvJSONFile() {
  await res.create()
}

/**
 * open adv project
 * `<root>/index.adv.json` file is required
 */
function openAdvProject() {
  // trigger open directory dialog
  const advExplorerDom = document.querySelector('#adv-explorer')
  const openDirBtn = advExplorerDom?.querySelector('.agui-open-directory') as HTMLElement
  if (openDirBtn) {
    openDirBtn.click()
  }
}

/**
 * new adv project
 */
function newAdvProject() {
  // @TODO
}
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center gap-8">
    <div class="flex gap-2">
      <t-button theme="default" variant="outline" @click="createAdvJSONFile">
        <template #icon>
          <div class="i-ri-file-line" />
        </template>
        <span class="ml-2">
          新建 ADV JSON 文件
        </span>
      </t-button>

      <t-button theme="default" variant="outline" @click="newAdvProject">
        <template #icon>
          <div class="i-ri-add-line" />
        </template>
        <span class="ml-2">
          新建 ADV 项目
        </span>
      </t-button>

      <t-button theme="default" variant="outline" @click="openAdvProject">
        <template #icon>
          <div class="i-ri-folder-open-line" />
        </template>
        <span class="ml-2">
          打开项目
        </span>
      </t-button>
    </div>

    <AEOpenAdvConfigFile />
  </div>
</template>
