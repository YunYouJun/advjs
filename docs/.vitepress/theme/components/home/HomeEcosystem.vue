<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCopy } from '../../composables/home'
import FeatureStatus from '../FeatureStatus.vue'

const t = useHomeCopy()

const groups = computed(() => {
  const c = t.value.ecosystem
  return [
    {
      title: c.stage,
      items: [
        { name: 'PixiJS', icon: 'i-ri-landscape-line' },
        { name: 'Three.js', icon: 'i-simple-icons-threedotjs', feature: 'three' },
        { name: 'Babylon.js', icon: 'i-simple-icons-babylondotjs' },
        { name: c.vrm, icon: 'i-ri-body-scan-line' },
      ],
    },
    {
      title: c.ai,
      items: [
        { name: 'OpenAI', icon: 'i-simple-icons-openai' },
        { name: 'Qwen TTS', icon: 'i-simple-icons-alibabacloud', feature: 'qwen-tts' },
        { name: 'Runware', icon: 'i-ri-image-ai-line' },
      ],
    },
    {
      title: c.publish,
      items: [
        { name: 'Cloudflare Pages', icon: 'i-simple-icons-cloudflarepages' },
        { name: c.cos, icon: 'i-ri-cloud-line' },
        { name: c.feishu, icon: 'i-vscode-icons-file-type-lark?mask' },
        { name: 'OBS', icon: 'i-simple-icons-obsstudio' },
        { name: 'Playwright', icon: 'i-simple-icons-playwright' },
      ],
    },
  ]
})
</script>

<template>
  <section id="ecosystem" class="h-section ecosystem" aria-labelledby="ecosystem-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#ecosystem">{#ecosystem}</a>
      <h2 id="ecosystem-title" class="h-title">
        {{ t.ecosystem.title }}
      </h2>
      <p class="h-lead">
        {{ t.ecosystem.lead }}
      </p>
    </header>

    <div class="groups">
      <div v-for="group in groups" :key="group.title" class="group">
        <h3 class="group-title">
          {{ group.title }}
        </h3>
        <ul class="items">
          <li v-for="item in group.items" :key="item.name">
            <span :class="item.icon" aria-hidden="true" />
            {{ item.name }}
            <FeatureStatus v-if="item.feature" :id="item.feature" />
          </li>
        </ul>
      </div>
    </div>

    <p class="more">
      <a class="h-link" href="/ecosystem/">{{ t.ecosystem.more }}</a>
    </p>
  </section>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 32px;
}

@media (min-width: 768px) {
  .groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.group {
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.group-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.items {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.items li {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 16px;
  color: var(--vp-c-text-1);
}

.items span {
  flex: none;
  font-size: 18px;
  color: var(--vp-c-text-2);
}

.more {
  margin: 28px 0 0;
  font-size: 15px;
}
</style>
