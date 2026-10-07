<script setup lang="ts">
import type { RuntimeErrorData } from '@advjs/types'
import type { DevToolsDiagnostic } from '../../src/types'
import DevToolsSection from './DevToolsSection.vue'

defineProps<{ diagnostics: DevToolsDiagnostic[], runtimeError?: RuntimeErrorData }>()
</script>

<template>
  <section class="diagnostics-view" aria-label="编译与运行时诊断">
    <DevToolsSection title="运行时错误" :meta="runtimeError ? '1 项' : '0 项'">
      <div v-if="runtimeError" class="diagnostic error">
        <strong>{{ runtimeError.code }}</strong><p>{{ runtimeError.message }}</p>
      </div>
      <p v-else class="section-empty">
        当前没有运行时错误。
      </p>
    </DevToolsSection>
    <DevToolsSection title="编译诊断" :meta="`${diagnostics.length} 项`">
      <div v-for="(item, index) in diagnostics" :key="index" class="diagnostic" :class="item.severity">
        <strong>{{ item.severity }} · {{ item.code }}</strong><p>{{ item.message }}</p>
        <code v-if="item.source">{{ item.source.file }}<template v-if="item.source.line">:{{ item.source.line }}:{{ item.source.column ?? 1 }}</template></code>
      </div>
      <p v-if="!diagnostics.length" class="section-empty">
        没有编译诊断。
      </p>
    </DevToolsSection>
  </section>
</template>
