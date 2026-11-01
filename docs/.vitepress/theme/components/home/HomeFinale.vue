<script setup lang="ts">
import { useHomeCopy } from '../../composables/home'
import { useHomeSkin } from '../../composables/skin'
import { skinComponents } from './data/skin-components'

const t = useHomeCopy()
const { skin } = useHomeSkin()
</script>

<template>
  <section class="h-section finale-wrap" :aria-label="t.finale.label">
    <component :is="skinComponents[skin].finale" class="h-skinned" />

    <footer class="colophon">
      <p class="thanks">
        So Long, and Thanks for All the <a href="https://sponsors.yunyoujun.cn" target="_blank" rel="noreferrer">Sponsors</a>.
      </p>
      <p>
        {{ t.finale.license[0] }}<a href="https://www.yunyoujun.cn" target="_blank" rel="noreferrer">YunYouJun</a>{{ t.finale.license[1] }}
      </p>
    </footer>
  </section>
</template>

<style scoped>
.colophon {
  margin-top: 40px;
  font-size: 14px;
  line-height: 1.8;
  text-align: center;
  color: var(--vp-c-text-2);
}

.colophon p {
  margin: 0;
}

.colophon .thanks {
  margin-bottom: 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.colophon a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.colophon a:hover {
  text-decoration: underline;
}
</style>
