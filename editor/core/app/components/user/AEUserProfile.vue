<script setup lang="ts">
import dayjs from 'dayjs'

const { loggedIn, user, session, clear } = useUserSession()
</script>

<template>
  <div v-if="loggedIn" class="ae-user-profile flex flex-col gap-2 items-center justify-center">
    <div class="border-1px border-gray-600 rounded-full size-18 shadow">
      <img v-if="user?.github?.avatar_url" :src="user?.github.avatar_url" alt="User Avatar" class="rounded-full size-full">
      <div v-else class="rounded-full bg-gray-200" />
    </div>

    <div class="text-xs flex flex-col gap-1 items-center justify-center">
      <div class="font-bold">
        {{ user?.github?.name }}
      </div>
      <a
        :href="user?.github?.html_url" target="_blank"
        class="op-80 flex gap-1 items-center hover:underline"
        :github-id="user?.github?.id"
      >
        <div i-ri-github-line /> {{ user?.github?.login }}
      </a>
      <div class="op-80">
        {{ user?.github?.email }}
      </div>

      <p class="text-xs op-50">
        Logged in since {{ dayjs(session?.loggedInAt as Date).format('YYYY-MM-DD HH:mm:ss') }}
      </p>
    </div>

    <AGUIButton size="mini" @click="clear">
      Sign Out
    </AGUIButton>
  </div>
</template>
