import axios from 'axios'
import { acceptHMRUpdate, defineStore } from 'pinia'

axios.defaults.baseURL = 'https://api.pominis.com/v1'

export const usePominisStore = defineStore('pominis', () => {
  async function fetchPominisStory(params: {
    id: string
    token?: string
  }) {
    try {
      if (params.token) {
        axios.defaults.headers.common.Authorization = `Bearer ${params.token}`
      }
      const response = await axios.get(`/adv/stories/${params.id}`)
      return response.data
    }
    catch (error) {
      console.error('Failed to fetch Pominis story:', error)
      throw error
    }
  }

  return {
    fetchPominisStory,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePominisStore as any, import.meta.hot))
