<template>
  <img class="adv-logo" alt="ADV logo" src="../assets/logo.svg" />
  <HelloWorld msg="Welcome to ADV.js" />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import HelloWorld from '../components/HelloWorld.vue';

export default defineComponent({
  name: 'Home',
  components: {
    HelloWorld,
  },
});
</script>

<style>
.adv-logo {
  width: 250px;
  margin: 0 auto;
}
</style>
