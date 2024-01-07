<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div>
    <AdvIconButton class="absolute left-5 top-5 cursor-pointer" @click="router.go(-1)">
      <AdvIcon>
        <div i-ri-arrow-left-line />
      </AdvIcon>
    </AdvIconButton>
  </div>
</template>
