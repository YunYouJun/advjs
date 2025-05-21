<script setup lang="ts">
import dayjs from 'dayjs'

const { loggedIn, user, session, clear } = useUserSession()
</script>

<template>
  <div v-if="loggedIn" class="ae-user-profile flex flex-col items-center justify-center gap-2">
    <div class="size-18 border-1px border-gray-600 rounded-full shadow">
      <img v-if="user?.github?.avatar_url" :src="user?.github.avatar_url" alt="User Avatar" class="size-full rounded-full">
      <div v-else class="rounded-full bg-gray-200" />
    </div>

    <div class="flex flex-col items-center justify-center gap-1 text-xs">
      <div class="font-bold">
        {{ user?.github.name }}
      </div>
      <a
        :href="user?.github.html_url" target="_blank"
        class="flex items-center gap-1 op-80 hover:underline"
        :github-id="user?.github.id"
      >
        <div i-ri-github-line /> {{ user?.github.login }}
      </a>
      <div class="op-80">
        {{ user?.github.email }}
      </div>

      <p class="text-xs op-50">
        Logged in since {{ dayjs(session?.loggedInAt as Date).format('YYYY-MM-DD HH:mm:ss') }}
      </p>
    </div>

    <t-button size="small" @click="clear">
      Sign Out
    </t-button>
  </div>
</template>
