<template>
  <div class="hello">
    <h1 class="text-4xl my-5">{{ msg }}</h1>
    <h2>面向未来与前端的 ADV 文字冒险游戏引擎</h2>
    <h3 class="my-5">开发中，敬请期待</h3>
    <h3 class="my-5">...</h3>
    <p>愿在未来的冒险中与你相遇<br /></p>

    <router-link class="block my-5" to="/demo">
      <button
        class="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded"
      >
        开始游戏
      </button>
    </router-link>

    <h3 class="mt-8">Other Links</h3>
    <ul>
      <li>
        <a
          href="https://github.com/YunYouJun/adv"
          target="_blank"
          rel="noopener"
          >GitHub</a
        >
      </li>
      <li>
        <a href="https://adv.js.org" target="_blank" rel="noopener">HomePage</a>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: String,
  },
});
</script>

<style>
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
</style>
