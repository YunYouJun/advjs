<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div>
    <AdvIconButton class="cursor-pointer left-5 top-5 absolute" @click="router.go(-1)">
      <AdvIcon>
        <div i-ri-arrow-left-line />
      </AdvIcon>
    </AdvIconButton>
  </div>
</template>
