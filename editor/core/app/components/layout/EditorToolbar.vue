<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'

const app = useAppStore()
const userStore = useUserStore()
// const { load, login } = useWxLogin()

const wxLoginDialogOpen = ref(false)

const tools = computed<ToolbarItem[]>(() => {
  const items: ToolbarItem[] = [
    {
      type: 'button',
      icon: 'i-ri-puzzle-line',
      title: 'Manage Plugins',
      onClick: () => {
      // eslint-disable-next-line no-alert
        alert('WIP: Manage Plugins')
      },
    },
    {
      type: 'separator',
    },
    {
      type: 'button',
      icon: 'i-ri-git-repository-line',
      title: 'Connect to Git Repository',
      onClick: () => {
      // eslint-disable-next-line no-alert
        alert('WIP: Connect to Git Repository for Version Control')
      },
    },
    {
      type: 'space',
    },
    {
      type: 'space',
    },
    {
      type: 'button',
      icon: 'i-ri-history-line',
      title: 'Undo History',
      onClick: () => {
      // app.showHistory()
      },
    },
    {
      type: 'button',
      name: 'Reset Layout',
      onClick: () => {
        app.resetLayout()
      },
    },
  ]

  if (userStore.loggedIn) {
    items.unshift({
    // type: 'button',
      type: 'dropdown',
      icon: 'i-mdi-account-circle',
      name: 'YunYouJun',
      children: [
        {
          label: 'My Account',
          type: 'item',
          onClick: () => {
          // eslint-disable-next-line no-alert
            alert('WIP: My Account')
          },
        },
        {
          label: 'Sign Out',
          type: 'item',
          onClick: () => {
          // eslint-disable-next-line no-alert
            alert('WIP: Sign Out')
          },
        },
      ],
    })
  }
  else {
    items.unshift({
      type: 'button',
      name: 'Sign In',
      onClick: () => {
        wxLoginDialogOpen.value = true
        // useWxLogin()
      },
    })
  }

  return items
})
</script>

<template>
  <AGUIToolbar :items="tools" />

  <AGUIDialog v-model:open="wxLoginDialogOpen" title="微信登录">
    <div id="wx-login-container" class="m-auto">
      TODO
    </div>
  </AGUIDialog>
</template>
