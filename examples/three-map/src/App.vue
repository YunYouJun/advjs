<script setup lang="ts">
import AdvThreeCanvas from '@advjs/plugin-three/client/AdvThreeCanvas.vue'
import { computed, shallowRef } from 'vue'
import { primitives, usePrimitiveScene } from './usePrimitiveScene'

const selected = shallowRef<string>()
const selectedLabel = computed(() => primitives.find(item => item.id === selected.value)?.label)
const { setup, options, frameAll, resolvePick } = usePrimitiveScene(selected)
</script>

<template>
  <main class="three-demo" data-adv-ui="game">
    <h1>Three.js 渲染示例</h1>
    <p>点击方块或通过列表选择。拖动旋转，右键平移，滚轮缩放。</p>
    <div class="three-demo-view">
      <AdvThreeCanvas label="三个可选择的方块" :setup="setup" :options="options" @pick="selected = resolvePick($event)">
        <template #error="{ retry }">
          <div class="three-demo-error">
            <p>3D 画布暂不可用，可通过下方列表选择。</p>
            <button type="button" @click="retry">
              重试画布
            </button>
          </div>
        </template>
      </AdvThreeCanvas>
    </div>
    <nav aria-label="场景操作">
      <button type="button" @click="frameAll">
        显示全部对象
      </button>
      <button v-for="item in primitives" :key="item.id" type="button" :aria-pressed="selected === item.id" @click="selected = item.id">
        {{ item.label }}
      </button>
    </nav>
    <p role="status">
      {{ selectedLabel ? `已选择 ${selectedLabel}` : '请选择一个方块' }}
    </p>
  </main>
</template>

<style scoped>
.three-demo {
  --adv-c-bg: #23282e;
  --adv-c-bg-alt: #333c46;
  --adv-c-text: #edf0f3;
  --adv-c-primary: #72ade4;
  --adv-c-focus: #72ade4;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24px;
  background: var(--adv-c-bg);
  color: var(--adv-c-text);
  font-family: sans-serif;
}
.three-demo h1 {
  margin: 0;
  font-size: 1.5rem;
}
.three-demo p {
  line-height: 1.5;
}
.three-demo-view {
  height: 420px;
}
.three-demo nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.three-demo button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: var(--adv-c-bg-alt);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.three-demo button:focus-visible,
.three-demo [aria-pressed='true'] {
  outline: 2px solid var(--adv-c-focus);
  outline-offset: 2px;
}
.three-demo-error {
  padding: 16px;
  text-align: center;
}
@media (max-width: 640px) {
  .three-demo {
    padding: 16px;
  }
  .three-demo-view {
    height: 280px;
  }
}
</style>
