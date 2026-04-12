import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from '@ionic/vue-router'
import TabsPage from '../views/TabsPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/workspace',
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/workspace',
      },
      {
        path: 'workspace',
        component: () => import('@/views/ProjectsPage.vue'),
      },
      {
        path: 'workspace/chapters',
        component: () => import('@/views/workspace/ChaptersPage.vue'),
      },
      {
        path: 'workspace/characters',
        component: () => import('@/views/workspace/CharactersPage.vue'),
      },
      {
        path: 'workspace/scenes',
        component: () => import('@/views/workspace/ScenesPage.vue'),
      },
      {
        path: 'workspace/locations',
        component: () => import('@/views/workspace/LocationsPage.vue'),
      },
      {
        path: 'workspace/audio',
        component: () => import('@/views/workspace/AudioPage.vue'),
      },
      {
        path: 'workspace/knowledge',
        component: () => import('@/views/workspace/KnowledgePage.vue'),
      },
      {
        path: 'workspace/marketplace',
        component: () => import('@/views/workspace/MarketplacePage.vue'),
      },
      // Legacy redirects
      {
        path: 'projects',
        redirect: '/tabs/workspace',
      },
      {
        path: 'chat',
        component: () => import('@/views/ChatPage.vue'),
      },
      {
        path: 'world',
        component: () => import('@/views/WorldPage.vue'),
      },
      {
        path: 'world/chat/:characterId',
        component: () => import('@/views/CharacterChatPage.vue'),
      },
      {
        path: 'world/diary/:characterId',
        component: () => import('@/views/CharacterDiaryPage.vue'),
      },
      {
        path: 'world/info/:characterId',
        component: () => import('@/views/CharacterInfoPage.vue'),
      },
      {
        path: 'world/group/:roomId',
        component: () => import('@/views/GroupChatPage.vue'),
      },
      {
        path: 'world/create-player',
        component: () => import('@/views/PlayerCreatorPage.vue'),
      },
      {
        path: 'play',
        component: () => import('@/views/PlayPage.vue'),
      },
      // Legacy redirect
      {
        path: 'preview',
        redirect: '/tabs/play',
      },
      // Me tab
      {
        path: 'me',
        component: () => import('@/views/MePage.vue'),
      },
      {
        path: 'me/settings',
        component: () => import('@/views/me/MeSettingsPage.vue'),
      },
      {
        path: 'me/settings/appearance',
        component: () => import('@/views/settings/SettingsAppearancePage.vue'),
      },
      {
        path: 'me/settings/cloud',
        component: () => import('@/views/settings/SettingsCloudPage.vue'),
      },
      {
        path: 'me/settings/ai',
        component: () => import('@/views/settings/SettingsAiPage.vue'),
      },
      {
        path: 'me/settings/language',
        component: () => import('@/views/settings/SettingsLanguagePage.vue'),
      },
      {
        path: 'me/settings/about',
        component: () => import('@/views/settings/SettingsAboutPage.vue'),
      },
      {
        path: 'me/developer',
        component: () => import('@/views/me/DeveloperPage.vue'),
      },
      {
        path: 'me/feedback',
        component: () => import('@/views/me/MeFeedbackPage.vue'),
      },
    ],
  },
  {
    path: '/editor',
    component: () => import('@/views/EditorPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
