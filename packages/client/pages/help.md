---
title: 帮助
---

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<div>
  <AdvIconButton class="absolute left-5 top-5 cursor-pointer" @click="router.go(-1)">
    <AdvIcon >
      <div i-ri-arrow-left-line />
    </AdvIcon>
  </AdvIconButton>
</div>

<route lang="yaml">
meta:
  layout: text
</route>

<div class="text-center">
  <div i-ri-question-line class="text-4xl mb-6 m-auto" />
  <h3>帮助</h3>
</div>

⁄(⁄ ⁄ ⁄ω⁄ ⁄ ⁄)⁄ 不可以看这里啦！
人家还没准备好！

<br />

<a class="flex justify-center items-center" href="https://github.com/YunYouJun/advjs" target="_blank">
<div i-ri-github-line />
&nbsp;
<span>advjs</span>
</a>
