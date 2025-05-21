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
        <t-button theme="default" block>
          <template #icon>
            <div i-ri-github-line />
          </template>
          <span class="ml-2" @click="userStore.loginWithGitHub()">
            Login with GitHub
          </span>
        </t-button>

        <!-- <t-button theme="success" block>
          <template #icon>
            <div i-ri-wechat-line />
          </template>
          <span class="ml-2">
            Login with WeChat (TODO)
          </span>
        </t-button> -->

        <div class="text-xs op-50">
          More login methods wip...
        </div>
      </div>
    </div>
  </AGUIDialog>
</template>
