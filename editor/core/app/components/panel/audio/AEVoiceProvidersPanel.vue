<script setup lang="ts">
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { reactive } from 'vue'
import { useVoiceProviderMaintenance } from '../../../composables/useVoiceProviderMaintenance'
import AEVoiceCleanupReview from './AEVoiceCleanupReview.vue'
import AEVoiceResourceSelection from './AEVoiceResourceSelection.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const maintenance = reactive(useVoiceProviderMaintenance(() => props.visible))
</script>

<template>
  <section class="ae-voice-providers" aria-label="语音供应商与卸载清理">
    <p v-if="!maintenance.available" class="ae-resource-caption">
      当前工作区没有本地供应商维护接口。共享服务与未登记目录需由其管理工具处理。
    </p>
    <template v-else>
      <AGUIProperty label="供应商">
        <AGUISelect v-model="maintenance.providerId" label="清理语音供应商" :options="maintenance.snapshot?.providers.map(item => ({ value: item.id, label: `${item.id} · ${item.enabled ? '启用' : '已停用'}` })) ?? []" :disabled="maintenance.pending" />
      </AGUIProperty>
      <div class="ae-resource-actions">
        <AGUIButton :loading="maintenance.pending" data-testid="cleanup-refresh" @click="maintenance.reload">
          刷新资源
        </AGUIButton>
        <AGUIButton v-if="maintenance.provider?.running && maintenance.provider.canStop" :disabled="maintenance.pending" data-testid="cleanup-stop" @click="maintenance.stop">
          停止受管理的服务
        </AGUIButton>
        <AGUIButton v-if="maintenance.provider && !maintenance.provider.enabled" :disabled="maintenance.pending" data-testid="cleanup-enable" @click="maintenance.enable">
          重新启用供应商
        </AGUIButton>
      </div>
      <template v-if="maintenance.provider">
        <p class="ae-resource-caption">
          {{ maintenance.provider.running ? '资源正在使用，清理前须停止服务。' : '本地服务未占用资源。' }}参考录音和已生成配音默认保留。
        </p>
        <p v-if="!maintenance.provider.managed" class="ae-resource-caption">
          此供应商未登记受管理的本地安装。可以停用，不自动删除外部目录。
        </p>
        <AEVoiceResourceSelection v-model:selected="maintenance.selected" v-model:allow-shared="maintenance.allowShared" :resources="maintenance.provider.resources" :pending="maintenance.pending" />
        <AGUIButton :disabled="maintenance.pending" data-testid="cleanup-plan" @click="maintenance.plan">
          预览停用与清理清单
        </AGUIButton>
      </template>
      <AEVoiceCleanupReview v-if="maintenance.review" v-model:reviewed="maintenance.reviewed" :plan="maintenance.review" :pending="maintenance.pending" @execute="maintenance.execute" />
      <p v-if="maintenance.result" role="status" data-testid="cleanup-result">
        供应商已停用，移除 {{ maintenance.result.removed.length }} 项资源，共 {{ (maintenance.result.removedBytes / 1024 / 1024).toFixed(1) }} MiB；卷可用空间变化 {{ (maintenance.result.availableSpaceDelta / 1024 / 1024).toFixed(1) }} MiB。
      </p>
      <p v-if="maintenance.error" class="ae-resource-error" role="alert">
        {{ maintenance.error }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.ae-voice-providers {
  display: grid;
  gap: 8px;
  padding: 8px;
  min-width: 0;
}
</style>
