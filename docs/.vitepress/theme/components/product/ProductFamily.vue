<script setup lang="ts">
import { withBase } from 'vitepress'

// The four places to write the same project, as the home page names them.
// The current page's row stays in the list, unlinked, so readers see where they are.
defineProps<{
  current: 'cli' | 'editor' | 'studio' | 'skills'
}>()

const tools = [
  { id: 'cli', where: '【终端里】', name: 'adv CLI', does: 'init、check、build、deploy，一条命令做一件事', href: '/guide/cli' },
  { id: 'editor', where: '【电脑前】', name: 'Editor', does: '流程图、剧本、试玩与素材摆在同一个工作区', href: '/guide/editor/' },
  { id: 'studio', where: '【手机上】', name: 'Studio', does: '随身管理项目、改章节、预览，托管 AI 起草', href: '/guide/studio/', status: 'studio' },
  { id: 'skills', where: '【Agent 里】', name: 'Skills', does: '让 Codex、Claude Code 或 Cursor 按 ADV.JS 的写法生成和审查', href: '/ai/skills/' },
] as const
</script>

<template>
  <section class="product-family" aria-label="同一份项目，同一套运行时">
    <h2 class="title">
      同一份项目，同一套运行时
    </h2>
    <p class="lead">
      这四个入口读写同一批 Markdown 文件，游戏也由同一个运行时播放。换个地方接着写，不用导出再导入。
    </p>
    <ul class="tools">
      <li v-for="tool in tools" :key="tool.id" :class="{ current: tool.id === current }">
        <span class="p-where">{{ tool.where }}</span>
        <span class="p-name">{{ tool.name }}<FeatureStatus v-if="'status' in tool" :id="tool.status" /></span>
        <span class="does">{{ tool.does }}</span>
        <span v-if="tool.id === current" class="here">本页</span>
        <a v-else class="go" :href="withBase(tool.href)" :aria-label="`${tool.name} 文档`">
          <span class="i-ri-arrow-right-line" aria-hidden="true" />
        </a>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.product-family {
  margin-top: 72px;
}

.vp-doc .title {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: var(--p-story);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.45;

  &::before {
    display: none;
  }
}

.vp-doc .lead {
  max-width: 34rem;
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.85;
  color: var(--vp-c-text-2);
}

.vp-doc .tools {
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--vp-c-divider);
}

.vp-doc .tools li {
  position: relative;
  display: grid;
  grid-template-columns: 6.5em minmax(0, 1fr) auto;
  grid-template-areas:
    'where name go'
    'where does go';
  gap: 0 12px;
  align-items: baseline;
  margin: 0;
  padding: 14px 0;
  border-bottom: 1px solid var(--vp-c-divider);

  @media (min-width: 640px) {
    grid-template-columns: 6.5em 8.5em minmax(0, 1fr) auto;
    grid-template-areas: 'where name does go';
  }
}

.p-where {
  grid-area: where;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.p-name {
  grid-area: name;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px 6px;
  align-items: center;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.does {
  grid-area: does;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.here {
  grid-area: go;
  font-family: var(--p-system);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--p-lamp);
}

.vp-doc .go {
  grid-area: go;
  display: inline-flex;
  color: var(--vp-c-text-2);
  text-decoration: none;

  // The whole row is the link target.
  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &:focus-visible {
    outline: none;

    &::after {
      outline: 2px solid var(--vp-c-brand-1);
      outline-offset: -2px;
    }
  }
}

.tools li:has(.go):hover {
  .p-name,
  .go {
    color: var(--vp-c-brand-1);
  }
}

.current .p-where {
  color: var(--p-lamp);
}
</style>
