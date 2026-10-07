<script setup lang="ts">
import type { DevToolsResource } from '../../src/types'
import { computed, ref } from 'vue'
import DevToolsSection from './DevToolsSection.vue'

const props = defineProps<{ resources: DevToolsResource[] }>()
const query = ref('')
const filtered = computed(() => props.resources.filter(item => `${item.type} ${item.id} ${item.name}`.toLowerCase().includes(query.value.toLowerCase())))
</script>

<template>
  <DevToolsSection title="资源清单" :meta="`${filtered.length} / ${resources.length} 项`" class="view-section">
    <template #toolbar>
      <label class="search">筛选资源<input v-model="query" type="search" placeholder="名称、ID 或类型"></label>
    </template>
    <ul class="resource-list">
      <li v-for="(item, index) in filtered" :key="`${item.type}:${item.id}:${index}`">
        <span class="resource-type">{{ item.type }}</span><div><strong>{{ item.name }}</strong><code>{{ item.id }}</code></div>
      </li>
    </ul>
    <p v-if="!filtered.length" class="section-empty">
      没有匹配的资源。
    </p>
  </DevToolsSection>
</template>
