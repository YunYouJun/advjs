import type { RestEndpointMethodTypes } from '@octokit/rest'
import { Octokit } from '@octokit/rest'
import { acceptHMRUpdate, defineStore } from 'pinia'

export type GitHubRepo = RestEndpointMethodTypes['repos']['listForAuthenticatedUser']['response']['data'][number] | RestEndpointMethodTypes['repos']['listForOrg']['response']['data'][number]
export type GitHubRepoInfo = RestEndpointMethodTypes['repos']['get']['response']['data']

export type GitHubUser = RestEndpointMethodTypes['users']['getAuthenticated']['response']['data']
export type GitHubOrg = RestEndpointMethodTypes['orgs']['listForAuthenticatedUser']['response']['data'][number]

export function decodeBase64(str: string) {
  // 1. 解码 Base64 得到二进制字符串
  const binaryString = atob(str)
  // 2. 将二进制字符串转为 Uint8Array
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  // 3. 使用 TextDecoder 按 UTF-8 解码
  return new TextDecoder('utf-8').decode(bytes)
}

export const useGitHubStore = defineStore('github', () => {
  // store
  const consoleStore = useConsoleStore()
  const projectStore = useProjectStore()

  const { user } = useUserSession()
  const octokit = shallowRef<Octokit>()
  // Create a personal access token at https://github.com/settings/tokens/new?scopes=repo
  // const octokit = new Octokit({ auth: `personal-access-token123` })

  const orgs = ref<RestEndpointMethodTypes['orgs']['listForAuthenticatedUser']['response']['data']>([])
  const repos = ref<GitHubRepo[]>([])
  const connectedRepo = ref<GitHubRepoInfo>()

  /**
   * selected owner
   * user or org
   */
  const selectedOwner = ref<GitHubUser | GitHubOrg>()

  watch(() => user.value?.github.access_token, () => {
    initOctokit()
    selectedOwner.value = user.value?.github
  }, { immediate: true })

  const searchKeywords = ref<string>('')
  const filteredRepos = computed(() => {
    if (!searchKeywords.value) {
      return repos.value
    }
    return repos.value.filter((repo) => {
      const name = repo.name.toLowerCase()
      const description = repo.description?.toLowerCase() || ''
      const keywords = searchKeywords.value.toLowerCase()
      return name.includes(keywords) || description.includes(keywords)
    })
  })

  function initOctokit() {
    octokit.value = new Octokit({
      auth: user.value?.github.access_token,
    })
  }

  /**
   * repos list
   */
  async function getOwnerRepos() {
    if (!user.value?.github.login) {
      return []
    }

    if (selectedOwner.value) {
      // @ts-expect-error selectedOwner.value is a GitHubUser
      if (selectedOwner.value.type === 'User') {
        const response = await octokit.value?.rest.repos.listForAuthenticatedUser({
          type: 'all',
          sort: 'pushed',
          direction: 'desc',
          per_page: 50,
        })
        if (response?.data) {
          repos.value = response.data
        }
        else {
          repos.value = []
        }
      }
      else {
        // not have type in org
        const response = await octokit.value?.rest.repos.listForOrg({
          org: selectedOwner.value.login,
          type: 'all',
          sort: 'pushed',
          direction: 'desc',
          per_page: 50,
        })
        if (response?.data) {
          repos.value = response.data
        }
        else {
          repos.value = []
        }
      }
    }
    return repos.value
  }

  /**
   * orgs list
   */
  async function getOrgs() {
    if (!user.value?.github.login) {
      return []
    }

    const response = await octokit.value?.rest.orgs.listForAuthenticatedUser()
    if (response?.data) {
      orgs.value = response.data
    }
    else {
      orgs.value = []
    }
    return response?.data
  }

  /**
   * get repo file content
   */
  async function getRepoFileContent(repo: GitHubRepo, path: string) {
    const res = await octokit.value?.rest.repos.getContent({
      owner: repo.owner.login,
      repo: repo.name,
      path,
      headers: {
        accept: 'application/vnd.github.v3.raw',
      },
    })
    if (res?.data) {
      // @ts-expect-error getContentRes.data.content is a string
      const content = decodeBase64(res.data.content)
      return content
    }
    else {
      console.error(res)
      return undefined
    }
  }

  /**
   * connect repo
   */
  async function connectRepo(repo: GitHubRepo) {
    if (!user.value?.github.login) {
      return
    }

    const getRepoInfoRes = await octokit.value?.rest.repos.get({
      owner: repo.owner.login,
      repo: repo.name,
    })
    if (getRepoInfoRes?.data) {
      connectedRepo.value = getRepoInfoRes.data
    }
    else {
      connectedRepo.value = undefined
    }

    // load github file content
    // load index.adv.json adv.config.json
    const [indexAdvJSONStr, advConfigJSONStr] = await Promise.all([
      getRepoFileContent(repo, 'index.adv.json'),
      getRepoFileContent(repo, 'adv.config.json'),
    ])

    if (!indexAdvJSONStr || !advConfigJSONStr) {
      console.error('index.adv.json or adv.config.json not found')
      if (!indexAdvJSONStr) {
        consoleStore.error('index.adv.json not found')
      }
      if (!advConfigJSONStr) {
        consoleStore.error('adv.config.json not found')
      }
      return getRepoInfoRes?.data
    }
    else {
      // load config firstly for cdn
      projectStore.loadAdvConfigJSON(advConfigJSONStr)
      projectStore.loadIndexAdvJSON(indexAdvJSONStr)
    }

    return getRepoInfoRes?.data
  }

  async function disconnectRepo() {
    connectedRepo.value = undefined
  }

  return {
    octokit,
    initOctokit,
    getOrgs,
    getOwnerRepos,

    searchKeywords,
    connectedRepo,
    connectRepo,
    disconnectRepo,

    user: computed(() => user.value?.github),
    orgs,
    repos,
    selectedOwner,
    filteredRepos,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGitHubStore, import.meta.hot))
