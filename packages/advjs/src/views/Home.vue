<template>
  <div id="nav">
    <router-link to="/">Home</router-link> |
    <router-link to="/demo">Demo</router-link> |
    <a href="https://www.yunyoujun.cn/posts/make-an-avg-engine/">About</a>
  </div>
  <img class="adv-logo" alt="ADV logo" src="../assets/logo.svg" />
  <HelloWorld msg="Welcome to ADV.js" />
</template>

<script lang="ts">
import HelloWorld from '../components/HelloWorld.vue';

export default {
  name: 'Home',
  components: {
    HelloWorld,
  },
};
</script>

<style>
.adv-logo {
  width: 250px;
  margin: 0 auto;
}
</style>
