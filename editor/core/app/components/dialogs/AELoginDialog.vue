<script setup lang="ts">
const userStore = useUserStore()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})
</script>

<template>
  <AGUIDialog v-model:open="open" :title="userStore.loggedIn ? 'My Account' : '登录'" content-class="w-sm h-auto">
    <div class="h-full flex flex-col items-center justify-center gap-4 p-6">
      <AEUserProfile v-if="userStore.loggedIn" />
      <div v-else id="login-container" class="max-w-md flex flex-col items-center justify-center gap-4">
        <AGUIButton icon="i-ri-github-line" @click="userStore.loginWithGitHub()">
          Login with GitHub
        </AGUIButton>

        <!-- <AGUIButton icon="i-ri-wechat-line">
          Login with WeChat (TODO)
        </AGUIButton> -->

        <div class="text-xs op-50">
          More login methods wip...
        </div>
      </div>
    </div>
  </AGUIDialog>
</template>
