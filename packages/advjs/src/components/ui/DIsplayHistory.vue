<template>
  <div
    class="adv-icon-button display-history-button"
    @click="$store.commit('toggleHistory')"
  >
    <icon-font name="message-2-line" color="white" size="3rem"></icon-font>
  </div>
</template>
