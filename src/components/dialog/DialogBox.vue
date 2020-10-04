<template>
  <div class="dialog-box w-screen h-64 fixed bottom-0 grid grid-cols-12 gap-16">
    <div class="dialog-name col-span-3 text-right">{{ dialog.name }}</div>
    <div class="dialog-content col-span-9 text-left pr-24">
      {{ dialog.words }}
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue';
interface Dialog {
  name?: string;
  words: string;
}

export default {
  props: {
    dialog: {
      type: Object as PropType<Dialog>,
    },
  },
};
</script>

<style lang="scss">
.dialog-box {
  background-image: linear-gradient(
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.9) 30%,
    black 100%
  );
  padding-top: 4rem;
  border: none;
}

.dialog-name {
  color: gray;
  font-size: 2rem;
}
.dialog-content {
  color: white;
  font-size: 1.5rem;
  margin-top: 0.3rem;
}
</style>
