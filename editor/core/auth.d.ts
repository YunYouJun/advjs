/**
 * @see 'nuxt-auth-utils/dist/runtime/server/lib/oauth/github'
 */
export interface FeishuUser {
  open_id: string
  union_id: string
  name: string
  avatar_url: string
  email?: string
  user_access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  refresh_expires_in: number
}

export interface GitHubUser {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  name: string
  company: string
  blog: string
  location: string
  email: string | null
  hireable: boolean | null
  bio: string | null
  twitter_username: string | null
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
  email_verified?: boolean
}

// auth.d.ts
declare module '#auth-utils' {

  interface User {
    // Add your own fields
    github?: GitHubUser & {
      access_token: string
    }
    feishu?: FeishuUser
  }

  interface UserSession {
    // Add your own fields
  }

  interface SecureSessionData {
    // Add your own fields
  }
}

export {}
