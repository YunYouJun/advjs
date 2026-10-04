<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'
import { useEditorCapabilities } from '../../composables/useEditorCapabilities'

const { t } = useI18n()
const app = useAppStore()
const capabilities = useEditorCapabilities()
const userStore = useUserStore()
const githubStore = capabilities.integrations.github ? useGitHubStore() : undefined

const dialogStore = useDialogStore()

const tools = computed<ToolbarItem[]>(() => {
  const items: ToolbarItem[] = [
    {
      type: 'button',
      icon: 'i-ri-puzzle-line',
      title: t('toolbar.plugins'),
      onClick: () => {
      // eslint-disable-next-line no-alert
        alert(t('toolbar.pluginsPending'))
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
      title: t('toolbar.history'),
      onClick: () => {
      // app.showHistory()
      },
    },
    {
      type: 'button',
      name: t('menu.resetLayout'),
      onClick: () => {
        app.resetLayout()
      },
    },
  ]

  if (!capabilities.account) {
    items.unshift({
      type: 'button',
      icon: 'i-ri-computer-line',
      name: t('workspace.local'),
      title: t('toolbar.localAccountHint'),
      onClick: () => {},
    })
  }
  else if (userStore.loggedIn) {
    items.unshift({
      // type: 'button',
      type: 'dropdown',
      // icon: 'i-mdi-account-circle',
      icon: 'i-ri-github-line',
      name: userStore.user?.github?.name,
      children: [
        {
          label: t('toolbar.account'),
          type: 'item',
          onClick: () => {
            dialogStore.openStates.login = true
          },
        },
        {
          label: t('toolbar.signOut'),
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
      title: t('toolbar.connectGit'),
      onClick: () => {
        dialogStore.openStates.githubRepos = true
      },
    }
    if (githubStore?.connectedRepo) {
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
      name: t('toolbar.signIn'),
      onClick: () => {
        dialogStore.openStates.login = true
      },
    })
  }

  return items
})
</script>

<template>
  <AGUIToolbar :items="tools">
    <template #after-toolbar>
      <EditorLanguageSelect />
    </template>
  </AGUIToolbar>
  <AELoginDialog v-model:open="dialogStore.openStates.login" />
</template>
