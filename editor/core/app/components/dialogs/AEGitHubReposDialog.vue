<script setup lang="ts">
import type { GitHubRepo } from '../../stores/useGitHubStore'
import { Toast } from '@advjs/gui'

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const dialogStore = useDialogStore()
const githubStore = useGitHubStore()

const ownerOptions = computed(() => {
  const options = [
    {
      icon: 'i-ri-user-line',
      label: githubStore.user!.login,
      value: githubStore.user!.login,
    },
  ]
  return [...options, ...githubStore.orgs.map(org => ({
    icon: 'i-ri-building-line',
    label: org.login!,
    value: org.login!,
  }))]
})

onMounted(async () => {
  await githubStore.getOrgs()
  await githubStore.getOwnerRepos()
})

const loading = ref(false)
async function connectRepo(repo: GitHubRepo) {
  loading.value = true
  await githubStore.connectRepo(repo)
  loading.value = false

  dialogStore.openStates.githubRepos = false
  Toast({
    title: 'Connected to GitHub Repo',
    description: `${repo.owner.login}/${repo.name}`,
    type: 'success',
  })
}

function openRepoUrl(repo: GitHubRepo) {
  window.open(repo.html_url, '_blank')
}
</script>

<template>
  <AGUIDialog v-model:open="open" title="Connect GitHub Repos" content-class="w-md h-md">
    <AGUILoading v-model:show="loading" class="absolute z-99" />
    <div class="size-full flex flex-col gap-1 p-1">
      <div class="actions flex items-center justify-end gap-1">
        <AGUISelect
          :options="ownerOptions"
          class="w-1/2"
          placeholder="Select Owner"
          :model-value="githubStore.selectedOwner?.login"
          :multiple="false"
          @update:model-value="async (value) => {
            loading = true
            if (value === githubStore.user?.login) {
              githubStore.selectedOwner = githubStore.user
            }
            else {
              githubStore.selectedOwner = githubStore.orgs.find((org) => org.login === value)!
            }
            await githubStore.getOwnerRepos()
            loading = false
          }"
        />

        <AGUIInput v-model="githubStore.searchKeywords" />

        <AGUIButton
          class="whitespace-nowrap"
          @click="async () => {
            loading = true
            await githubStore.getOwnerRepos()
            loading = false
          }"
        >
          Refresh Repos
        </AGUIButton>
      </div>

      <ul class="flex flex-col gap-1 overflow-auto">
        <li
          v-for="repo in githubStore.filteredRepos" :key="repo.id"
          class="flex items-center justify-between gap-1 rounded bg-dark-200 p-1.5 hover:bg-dark-100"
        >
          <div class="w-xs flex items-center gap-1">
            <img :src="repo.owner.avatar_url" class="size-8 rounded-full">
            <div class="min-w-0 flex flex-col">
              <h3 class="truncate text-sm font-semibold">
                {{ repo.owner.login }}/{{ repo.name }}
              </h3>
              <p class="truncate text-xs text-gray-500">
                {{ repo.description }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <AGUIButton size="mini" variant="outline" @click="openRepoUrl(repo)">
              <div i-ri-external-link-line />
            </AGUIButton>
            <AGUIButton v-if="githubStore.connectedRepo?.id !== repo.id" size="mini" @click="connectRepo(repo)">
              Connect
            </AGUIButton>
            <AGUIButton v-else size="mini" variant="outline" @click="githubStore.disconnectRepo()">
              Disconnect
            </AGUIButton>
          </div>
        </li>
      </ul>
    </div>
  </AGUIDialog>
</template>
