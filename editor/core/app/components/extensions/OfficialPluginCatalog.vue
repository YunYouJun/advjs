<script setup lang="ts">
import type { VoiceProviderStatusPort } from '@advjs/types'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed, reactive, shallowRef, useId } from 'vue'
import { useOfficialPluginStatus } from '../../composables/useOfficialPluginStatus'
import { officialPlugins } from '../../extensions/official-plugins'
import { officialPluginStatus } from './official-plugin-presentation'
import OfficialPluginDetails from './OfficialPluginDetails.vue'
import OfficialPluginSelection from './OfficialPluginSelection.vue'

const props = withDefaults(defineProps<{ locale: string, port?: VoiceProviderStatusPort, visible?: boolean }>(), { visible: true })
const zh = computed(() => props.locale === 'zh-CN')
const status = reactive(useOfficialPluginStatus(() => props.port, () => props.visible))
const selectedId = shallowRef(officialPlugins[0]?.id ?? '')
const detailsId = useId()
const items = computed(() => officialPlugins.map((entry) => {
  const provider = status.snapshot?.providers.find(item => item.id === entry.id)
  const diagnosis = status.diagnoses[entry.id]
  const failed = Boolean(status.failures[entry.id])
  return { entry, provider, diagnosis, failed, status: officialPluginStatus({ entry, provider, diagnosis, failed, connected: Boolean(props.port), loading: status.loading, readFailed: status.readFailed, checking: status.checking }, props.locale) }
}))
const selected = computed(() => items.value.find(item => item.entry.id === selectedId.value) ?? items.value[0])
</script>

<template>
  <section class="official-plugin-catalog" :aria-label="zh ? '官方插件目录' : 'Official plugin catalog'" data-testid="official-plugin-catalog" :aria-busy="status.loading">
    <header class="official-catalog-heading">
      <div class="official-catalog-title-group">
        <h3 class="official-catalog-title">
          {{ zh ? '官方插件目录' : 'Official plugin catalog' }}
        </h3>
        <span class="official-catalog-count">{{ zh ? `作者音频 · ${officialPlugins.length} 项` : `Authoring audio · ${officialPlugins.length} entries` }}</span>
      </div>
      <AGUIButton :disabled="!port || !!status.checking" :loading="status.loading" data-testid="official-catalog-refresh" @click="status.reload">
        {{ zh ? '刷新项目配置' : 'Refresh project configuration' }}
      </AGUIButton>
    </header>
    <p class="official-catalog-caption">
      {{ zh ? '选择插件，查看能力、运行要求与源码接入。状态检测仅在点击后执行。' : 'Choose an adapter to view capabilities, requirements, and source setup. Diagnostics run only when requested.' }}
    </p>
    <p v-if="!port" class="official-catalog-caption" role="status" data-testid="official-catalog-no-host">
      {{ zh ? '当前工作区没有 Node 状态接口。使用 adv editor /absolute/path/to/game 打开已配置的本地项目后，可检查供应商。' : 'This workspace has no Node status interface. Open a configured local project with adv editor /absolute/path/to/game to check providers.' }}
    </p>
    <p v-if="status.readFailed" class="official-catalog-error" role="alert">
      {{ zh ? '无法读取项目供应商配置，请检查 adv.config.ts 后刷新。未执行环境检测。' : 'Could not read provider configuration. Check adv.config.ts and refresh. Environment diagnostics were not run.' }}
    </p>
    <div class="official-catalog-workspace" data-testid="official-catalog-workspace">
      <OfficialPluginSelection v-model:selected-id="selectedId" :items="items" :locale="locale" :details-id="detailsId" />
      <div :id="detailsId" class="official-catalog-detail">
        <OfficialPluginDetails v-if="selected" :key="selected.entry.id" :item="selected" :locale="locale" :loading="status.loading" :read-failed="status.readFailed" :checking="status.checking" @check="status.check" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.official-plugin-catalog {
  min-width: 0;
  margin-top: var(--agui-space-4);
  padding-top: var(--agui-space-3);
  border-top: 1px solid var(--agui-c-divider);
  container: official-plugin-catalog / inline-size;
}
.official-catalog-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--agui-space-2);
}
.official-catalog-title-group {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--agui-space-1) var(--agui-space-2);
}
.official-catalog-title {
  margin: 0;
  font-size: var(--agui-font-size-heading);
  font-weight: 600;
}
.official-catalog-count {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
}
.official-catalog-caption {
  margin: var(--agui-space-2) 0 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.official-catalog-error {
  margin: var(--agui-space-2) 0 0;
  color: var(--agui-c-danger-text);
  font-size: var(--agui-font-size-body);
}
.official-catalog-workspace {
  display: grid;
  gap: var(--agui-space-3);
  margin-top: var(--agui-space-3);
  min-width: 0;
}
.official-catalog-detail {
  min-width: 0;
  padding-top: var(--agui-space-3);
  border-top: 1px solid var(--agui-c-divider-light);
}
@container official-plugin-catalog (min-width: 640px) {
  .official-catalog-workspace {
    grid-template-columns: minmax(200px, 0.7fr) minmax(0, 1.3fr);
    align-items: start;
  }
  .official-catalog-detail {
    padding-top: 0;
    padding-left: var(--agui-space-3);
    border-top: 0;
    border-left: 1px solid var(--agui-c-divider-light);
  }
}
</style>
