<script setup lang="ts">
import { useGameConfig } from '@advjs/client'

const gameConfig = useGameConfig()
</script>

<template>
  <main class="hamster-credits" :style="{ '--hamster-cover': `url(${gameConfig.cover})` }">
    <div class="hamster-credits__panel">
      <RouterLink class="hamster-credits__back" to="/start">
        ← 返回标题
      </RouterLink>
      <p class="hamster-credits__eyebrow">
        ABOUT THE ARCHIVE
      </p>
      <h1>关于</h1>
      <p class="hamster-credits__lead">
        游戏内只呈现故事。来源、改编边界与许可集中保存在这里。
      </p>

      <section>
        <h2>故事来源</h2>
        <ul>
          <li><a href="https://www.yunyoujun.cn/posts/hamster" target="_blank" rel="noreferrer">YunYouJun《仓鼠》</a></li>
          <li><a href="https://www.yunyoujun.cn/posts/the-common-hamster" target="_blank" rel="noreferrer">YunYouJun《仓生》</a></li>
        </ul>
        <p>本作将两份故事文本整理为一条连续航线；通关后开放独立的“回声演算”。</p>
      </section>

      <section>
        <h2>许可与素材</h2>
        <p>原作与改编内容采用 CC BY-NC-SA 4.0。角色立绘与背景为本 Demo 生成素材；详细来源与工具记录见项目内 ASSETS.md 与 LICENSE.content.md。</p>
      </section>
    </div>
  </main>
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>

<style scoped>
.hamster-credits {
  min-height: 100%;
  overflow: auto;
  background:
    linear-gradient(90deg, rgb(7 10 18 / 98%), rgb(7 10 18 / 78%)),
    var(--hamster-cover) center / cover fixed;
  color: #f3eee4;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: left;
}

.hamster-credits__panel {
  width: min(44rem, calc(100% - 3rem));
  margin: 0 auto;
  padding: clamp(3rem, 9vh, 7rem) 0;
}

.hamster-credits__back,
.hamster-credits a {
  color: #75ddeb;
  text-decoration: none;
}
.hamster-credits__eyebrow {
  margin-top: 4rem;
  color: #f6c96b;
  font: 0.72rem/1.2 monospace;
  letter-spacing: 0.22em;
}
.hamster-credits h1 {
  margin: 0.65rem 0 1rem;
  font:
    700 clamp(2.6rem, 7vw, 5.5rem)/1 'Songti SC',
    STSong,
    serif;
}
.hamster-credits__lead {
  color: #c8d0e0;
  font:
    1.1rem/1.8 'Songti SC',
    STSong,
    serif;
}
.hamster-credits section {
  margin-top: 3rem;
  border-top: 1px solid rgb(174 184 206 / 25%);
  padding-top: 1.5rem;
}
.hamster-credits h2 {
  color: #f6c96b;
  font:
    500 1.25rem/1.5 'Songti SC',
    STSong,
    serif;
  letter-spacing: 0.12em;
}
.hamster-credits li,
.hamster-credits section p {
  color: #aeb8ce;
  line-height: 1.8;
}
</style>
