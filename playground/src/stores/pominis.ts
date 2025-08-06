import type { AdvGameConfig } from '../../../packages/types/src'
import axios from 'axios'
import { acceptHMRUpdate, defineStore } from 'pinia'

axios.defaults.baseURL = import.meta.env.DEV ? 'http://localhost:3333/v1' : 'https://api.pominis.com/v1'

export const usePominisStore = defineStore('pominis', () => {
  const curPominisStory = ref<AdvGameConfig>()

  async function fetchPominisStory(params: {
    id: string
    token?: string
  }) {
    // mock data
    try {
      if (params.token) {
        axios.defaults.headers.common.Authorization = `Bearer ${params.token}`
      }
      const response = await axios.get(`/adv/stories/${params.id}`)
      curPominisStory.value = response.data
      return response.data
    }
    catch (error) {
      console.error('Failed to fetch Pominis story:', error)
      throw error
    }
  }

  return {
    curPominisStory,
    fetchPominisStory,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePominisStore as any, import.meta.hot))
