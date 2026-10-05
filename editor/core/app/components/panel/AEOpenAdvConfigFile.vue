<script setup lang="ts">
import ProjectAction from './ProjectAction.vue'

const fileStore = useFileStore()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
</script>

<template>
  <div class="config-actions">
    <ProjectAction :label="zh ? '本地配置文件' : 'Local configuration'" description="adv.config.json" icon="i-ri-settings-3-line" @click="fileStore.openAdvConfigFile" />
    <ProjectAction :label="zh ? '在线配置文件' : 'Online configuration'" :description="zh ? '加载远程 adv.config' : 'Load remote adv.config'" icon="i-ri-cloud-line" @click="fileStore.onlineAdvConfigFileDialogOpen = true" />
  </div>
</template>

<style scoped>
.config-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 4px;
}
</style>
