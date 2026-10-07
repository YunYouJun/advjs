<script setup lang="ts">
import { computed } from 'vue'
import { useProjectAssetActions } from '../../../composables/useProjectAssetActions'
import { useProjectFileActions } from '../../../composables/useProjectFileActions'
import { isProjectAsset } from '../../../utils/asset-browser'
import { projectFileKind } from '../../../utils/project-files'

const props = withDefaults(defineProps<{ path?: string, asset?: boolean }>(), { asset: false })
const file = useFileStore()
const { open } = useProjectFileActions()
const { showInAssets, showInProject } = useProjectAssetActions()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const path = computed(() => props.asset ? props.path ?? '' : file.openedFilePath || file.fileName)
const name = computed(() => props.asset ? path.value.split('/').at(-1) : file.fileName)
const fileKind = computed(() => props.asset ? projectFileKind(path.value) : file.fileKind)
const kind = computed(() => ({ text: zh.value ? '文本' : 'Text', image: zh.value ? '图片' : 'Image', audio: zh.value ? '音频' : 'Audio', video: zh.value ? '视频' : 'Video', model: zh.value ? '模型' : 'Model', unsupported: zh.value ? '其他' : 'Other' })[fileKind.value])
</script>

<template>
  <section v-if="name" class="file-properties">
    <AGUIDetails :title="asset ? (zh ? '素材信息' : 'Asset information') : (zh ? '文件信息' : 'File information')" open>
      <AGUIProperty :label="zh ? '名称' : 'Name'">
        <span>{{ name }}</span>
      </AGUIProperty>
      <AGUIProperty :label="zh ? '路径' : 'Path'">
        <span>{{ path }}</span>
      </AGUIProperty>
      <AGUIProperty :label="zh ? '类型' : 'Type'">
        <span>{{ kind }}</span>
      </AGUIProperty>
      <AGUIProperty v-if="!asset && file.openedFileHandle && file.fileKind === 'text'" :label="zh ? '状态' : 'Status'">
        <span>{{ file.isDirty ? (zh ? '有未保存修改' : 'Unsaved changes') : (zh ? '已保存' : 'Saved') }}</span>
      </AGUIProperty>
    </AGUIDetails>
    <AGUIToolbar v-if="isProjectAsset(path)" :items="[]" :label="zh ? '素材操作' : 'Asset actions'">
      <template #before-toolbar>
        <AGUIButton v-if="asset" @click="open(path)">
          {{ zh ? '打开预览' : 'Open preview' }}
        </AGUIButton>
        <AGUIButton @click="showInProject(path)">
          {{ zh ? '在项目中定位' : 'Show in Project' }}
        </AGUIButton>
        <AGUIButton @click="showInAssets(path)">
          {{ zh ? '在素材中显示' : 'Show in Assets' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
  </section>
  <p v-else-if="asset" class="file-properties-empty" role="status">
    {{ zh ? '从素材浏览器中选择素材查看属性。' : 'Select an asset in the browser to inspect it.' }}
  </p>
  <InspectorView v-else />
</template>

<style scoped>
.file-properties {
  container: agui-properties / inline-size;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.file-properties-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--agui-c-text-2);
}
</style>
