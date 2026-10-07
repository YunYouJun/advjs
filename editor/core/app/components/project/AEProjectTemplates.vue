<script setup lang="ts">
import room from '../../../../../demo/starter/public/img/room.svg?url'
import { PROJECT_TEMPLATES } from '../../composables/useCreateProject'
import ProjectAction from '../panel/ProjectAction.vue'

defineProps<{ disabled?: boolean, creating?: boolean }>()
defineEmits<{ create: [templateId: string] }>()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const templates = computed(() => PROJECT_TEMPLATES.filter(item => item.category !== 'example' && item.category !== 'legacy').map(item => ({
  ...item,
  label: zh.value ? item.name : item.nameEn ?? item.name,
  description: zh.value ? item.desc : item.descEn ?? item.desc,
})))
</script>

<template>
  <section class="welcome-templates" :aria-label="zh ? '新建项目' : 'New project'">
    <h2 class="welcome-section-title">
      {{ zh ? '新建项目' : 'New project' }}
    </h2>
    <article class="welcome-example">
      <img :src="room" alt="" class="welcome-example-image">
      <div class="welcome-example-copy">
        <span class="welcome-example-label">{{ zh ? '入门示例' : 'Starter example' }}</span>
        <h3 class="welcome-example-title">
          {{ zh ? '你好，ADV.JS' : 'Hello, ADV.JS' }}
        </h3>
        <p class="welcome-example-description">
          {{ zh ? '跟随向导小云，运行并修改你的第一段故事。' : 'Follow guide Xiaoyun, then make this short introduction your own.' }}
        </p>
        <p class="welcome-example-meta">
          {{ zh ? '人物头像 · 分支选项 · 变量 · 本地素材' : 'Portraits · Branching choices · Variables · Local assets' }}
        </p>
        <AGUIButton theme="primary" icon="i-ri-add-line" :disabled="disabled" :loading="creating" @click="$emit('create', 'starter')">
          {{ zh ? '创建示例项目' : 'Create example project' }}
        </AGUIButton>
      </div>
    </article>
    <div class="welcome-template-list">
      <ProjectAction v-for="template in templates" :key="template.id" :label="template.label" :description="template.description" :icon="template.icon" :disabled="disabled" @click="$emit('create', template.id)" />
    </div>
  </section>
</template>

<style scoped>
.welcome-section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.welcome-example {
  overflow: hidden;
  border: 1px solid var(--agui-c-border);
  border-radius: 3px;
  background: var(--agui-c-bg-panel);
}
.welcome-example-image {
  display: block;
  width: 100%;
  height: 144px;
  object-fit: cover;
}
.welcome-example-copy {
  padding: 12px;
}
.welcome-example-label {
  font-size: 12px;
  color: var(--agui-c-link);
}
.welcome-example-title {
  margin: 4px 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.welcome-example-description,
.welcome-example-meta {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--agui-c-text-2);
}
.welcome-template-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
  gap: 4px;
  margin-top: 8px;
}
</style>
