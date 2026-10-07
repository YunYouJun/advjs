<script setup lang="ts">
import type { DevToolsSnapshot } from '../../src/types'
import DevToolsSection from './DevToolsSection.vue'

defineProps<{ snapshot: DevToolsSnapshot }>()
</script>

<template>
  <DevToolsSection title="运行概览" class="runtime-overview">
    <dl class="metadata">
      <div>
        <dt>状态</dt>
        <dd><span class="runtime-status" :class="{ 'is-error': snapshot.state.error }">{{ snapshot.state.status }}</span></dd>
      </div>
      <div>
        <dt>章节 / 节点</dt>
        <dd><code>{{ snapshot.state.cursor.chapterId }} / {{ snapshot.state.cursor.nodeId }}</code></dd>
      </div>
      <div>
        <dt>当前内容</dt>
        <dd><code>{{ snapshot.current?.kind ?? '—' }}</code></dd>
      </div>
      <div>
        <dt>程序</dt>
        <dd>{{ snapshot.program?.chapters ?? 0 }} 章 · {{ snapshot.program?.nodes ?? 0 }} 节点</dd>
      </div>
    </dl>
  </DevToolsSection>
</template>
