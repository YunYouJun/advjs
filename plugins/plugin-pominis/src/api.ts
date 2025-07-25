import axios from 'axios'

/**
 * fetch Pominis story by storyId
 */
export async function fetchPominisStory(params: {
  storyId: string
  token?: string
}) {
  // const client = axios.create({
  //   baseURL: 'https://api.pominis.com/v1',
  // })
  axios.defaults.baseURL = 'https://api.pominis.com/v1'
  // 设置请求标头 origin
  axios.defaults.headers.common.Origin = 'https://play.pominis.com'
  try {
    if (params.token) {
      axios.defaults.headers.common.Authorization = `Bearer ${params.token}`
    }
    const response = await axios.get(`/adv/stories/${params.storyId}`)
    return response.data
  }
  catch (error) {
    console.error('Failed to fetch Pominis story:', error)
    throw error
  }
}
