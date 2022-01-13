<template>
  <AdvModal v-show="app.showHistory" @close="app.toggleHistory">
    <div />
  </AdvModal>
</template>

<script lang="ts" setup>import { useAppStore } from '~/stores/app'

const app = useAppStore()
</script>
