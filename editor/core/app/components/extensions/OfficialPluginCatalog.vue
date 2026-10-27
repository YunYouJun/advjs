<script setup lang="ts">
import type { VoiceProviderStatusPort } from '@advjs/types'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed, reactive } from 'vue'
import { useOfficialPluginStatus } from '../../composables/useOfficialPluginStatus'
import { officialPlugins } from '../../extensions/official-plugins'
import OfficialPluginRow from './OfficialPluginRow.vue'

const props = withDefaults(defineProps<{ locale: string, port?: VoiceProviderStatusPort, visible?: boolean }>(), { visible: true })
const zh = computed(() => props.locale === 'zh-CN')
const status = reactive(useOfficialPluginStatus(() => props.port, () => props.visible))
</script>

<template>
  <section class="official-plugin-catalog" :aria-label="zh ? '官方插件目录' : 'Official plugin catalog'" data-testid="official-plugin-catalog" :aria-busy="status.loading">
    <header class="official-catalog-heading">
      <strong>{{ zh ? '官方插件目录' : 'Official plugin catalog' }}</strong>
      <span class="official-catalog-caption">{{ zh ? `作者音频 · ${officialPlugins.length} 项` : `Authoring audio · ${officialPlugins.length} entries` }}</span>
      <AGUIButton :disabled="!port || !!status.checking" :loading="status.loading" data-testid="official-catalog-refresh" @click="status.reload">
        {{ zh ? '刷新项目配置' : 'Refresh project configuration' }}
      </AGUIButton>
    </header>
    <p class="official-catalog-caption">
      {{ zh ? '由 ADV.JS 维护的供应商适配器，复用音频创作界面。当前按源码构建与本地链接接入；这里不提供 npm 安装或模型自动部署。' : 'ADV.JS-maintained provider adapters reuse the audio workspace. Build from source and link locally; this catalog does not install npm packages or deploy models.' }}
    </p>
    <p v-if="!port" class="official-catalog-caption" role="status" data-testid="official-catalog-no-host">
      {{ zh ? '当前工作区没有 Node 状态接口。使用 adv editor /absolute/path/to/game 打开已配置的本地项目后，可检查供应商。' : 'This workspace has no Node status interface. Open a configured local project with adv editor /absolute/path/to/game to check providers.' }}
    </p>
    <p v-if="status.readFailed" class="official-catalog-error" role="alert">
      {{ zh ? '无法读取项目供应商配置，请检查 adv.config.ts 后刷新。未执行环境检测。' : 'Could not read provider configuration. Check adv.config.ts and refresh. Environment diagnostics were not run.' }}
    </p>
    <ul class="official-catalog-list">
      <OfficialPluginRow
        v-for="entry in officialPlugins" :key="entry.id" :entry="entry" :locale="locale"
        :provider="status.snapshot?.providers.find(item => item.id === entry.id)" :diagnosis="status.diagnoses[entry.id]"
        :connected="!!port" :loading="status.loading" :read-failed="status.readFailed"
        :checking="status.checking" :failed="status.failures[entry.id]" @check="status.check"
      />
    </ul>
  </section>
</template>

<style scoped>
.official-plugin-catalog {
  min-width: 0;
  margin-top: 16px;
  border-top: 1px solid var(--agui-c-divider);
  padding-top: 12px;
}
.official-catalog-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.official-catalog-caption {
  margin: 6px 0;
  font-size: 12px;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.official-catalog-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.official-catalog-error {
  color: var(--agui-c-danger-text);
  font-size: 12px;
}
</style>
