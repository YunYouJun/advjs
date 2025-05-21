<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'

const app = useAppStore()
const userStore = useUserStore()
const githubStore = useGitHubStore()

const dialogStore = useDialogStore()

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
      // icon: 'i-mdi-account-circle',
      icon: 'i-ri-github-line',
      name: userStore.user?.github.name,
      children: [
        {
          label: 'My Account',
          type: 'item',
          onClick: () => {
            dialogStore.openStates.login = true
          },
        },
        {
          label: 'Sign Out',
          type: 'item',
          onClick: () => {
            userStore.signOut()
          },
        },
      ],
    })

    const connectGitHubRepoItem: ToolbarItem = {
      type: 'button',
      icon: 'i-ri-git-repository-line',
      title: 'Connect to Git Repository',
      onClick: () => {
        dialogStore.openStates.githubRepos = true
      },
    }
    if (githubStore.connectedRepo) {
      connectGitHubRepoItem.name = `${githubStore.connectedRepo.owner.login}/${githubStore.connectedRepo.name}`
      connectGitHubRepoItem.icon = 'i-ri-git-repository-fill'
    }
    // insert index
    items.splice(2, 0, {
      type: 'separator',
    }, connectGitHubRepoItem)
  }
  else {
    items.unshift({
      type: 'button',
      name: 'Sign In',
      onClick: () => {
        dialogStore.openStates.login = true
      },
    })
  }

  return items
})
</script>

<template>
  <AGUIToolbar :items="tools" />
  <AELoginDialog v-model:open="dialogStore.openStates.login" />
</template>
