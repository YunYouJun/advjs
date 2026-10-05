<script setup lang="ts">
import { useEditorPluginContext } from '@advjs/editor-sdk'
import { computed } from 'vue'

const ctx = useEditorPluginContext()
const project = ctx.project.current
const zh = computed(() => ctx.locale.value === 'zh-CN')
const errors = computed(() => project.value?.diagnostics.filter(item => item.severity === 'error').length ?? 0)
const warnings = computed(() => project.value?.diagnostics.filter(item => item.severity === 'warning').length ?? 0)
</script>

<template>
  <section class="diagnostics-view" :aria-label="zh ? '项目诊断' : 'Project diagnostics'">
    <p v-if="!project">
      {{ zh ? '打开项目后查看编译诊断。' : 'Open a project to inspect compilation diagnostics.' }}
    </p>
    <template v-else>
      <header>
        <strong>{{ project.name }}</strong>
        <span>{{ errors }} {{ zh ? '错误' : 'errors' }} · {{ warnings }} {{ zh ? '警告' : 'warnings' }}</span>
      </header>
      <p v-if="!project.diagnostics.length" role="status">
        {{ zh ? '未发现编译问题。' : 'No compilation issues found.' }}
      </p>
      <ol v-else>
        <li v-for="(diagnostic, index) in project.diagnostics" :key="index" :data-severity="diagnostic.severity">
          <div class="diagnostic-heading">
            <strong>{{ diagnostic.severity === 'error' ? (zh ? '错误' : 'Error') : (zh ? '警告' : 'Warning') }} · {{ diagnostic.code }}</strong>
            <code v-if="diagnostic.path">{{ diagnostic.path }}{{ diagnostic.line ? `:${diagnostic.line}` : '' }}</code>
          </div>
          <p>{{ diagnostic.message }}</p>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.diagnostics-view {
  padding: 8px 12px;
  color: var(--agui-c-text-1);
  font-size: 13px;
  line-height: 1.5;
}
header,
.diagnostic-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}
strong {
  font-weight: 600;
}
header span,
code {
  font-size: 12px;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
ol {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
}
li {
  padding: 8px 0;
  border-top: 1px solid var(--agui-c-divider);
}
li[data-severity='error'] strong {
  color: var(--agui-c-danger-text);
}
p {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
</style>
