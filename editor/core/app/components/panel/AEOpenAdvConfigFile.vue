<script setup lang="ts">
const fileStore = useFileStore()
</script>

<template>
  <div class="flex gap-3">
    <button
      class="config-card group flex items-center gap-2.5 px-4 py-3"
      @click="fileStore.openAdvConfigFile"
    >
      <div class="config-card-icon">
        <div class="i-ri-settings-3-line" />
      </div>
      <div class="text-left">
        <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
          本地配置文件
        </div>
        <div class="text-11px op-35 transition-opacity group-hover:op-50">
          打开 adv.config.json
        </div>
      </div>
    </button>

    <button
      class="config-card group flex items-center gap-2.5 px-4 py-3"
      @click="fileStore.onlineAdvConfigFileDialogOpen = true"
    >
      <div class="config-card-icon">
        <div class="i-ri-cloud-line" />
      </div>
      <div class="text-left">
        <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
          在线配置文件
        </div>
        <div class="text-11px op-35 transition-opacity group-hover:op-50">
          加载远程 adv.config
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.config-card {
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition:
    border-color 200ms ease,
    background-color 200ms ease,
    box-shadow 200ms ease,
    transform 150ms ease;
}

.config-card:hover {
  border-color: rgba(71, 114, 179, 0.5);
  background: rgba(71, 114, 179, 0.06);
  box-shadow:
    0 0 0 1px rgba(71, 114, 179, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.config-card:active {
  transform: scale(0.98);
  border-color: rgba(71, 114, 179, 0.6);
  background: rgba(71, 114, 179, 0.1);
}

.config-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  font-size: 14px;
  flex-shrink: 0;
  color: #7ba4d9;
  background: rgba(71, 114, 179, 0.12);
  border: 1px solid rgba(71, 114, 179, 0.15);
  transition:
    background-color 200ms ease,
    border-color 200ms ease;
}

.config-card:hover .config-card-icon {
  background: rgba(71, 114, 179, 0.2);
  border-color: rgba(71, 114, 179, 0.3);
}
</style>
