<!-- eslint-disable no-alert -->
<script setup lang="ts">
import type { AGUISidebarMenuItem } from '@advjs/gui/runtime'

import { useRouter } from 'vitepress'
import { ref } from 'vue'

const router = useRouter()

const activeKey = ref<string>('')
const sidebarMenu = ref<AGUISidebarMenuItem[]>([
  { key: 'home', title: 'Home', icon: 'i-ri-home-2-line', onClick: () => router.go('/') },
  { key: 'profile', title: 'Profile', icon: 'i-ri-user-3-line', onClick: () => {} },
  { key: 'settings', title: 'Settings', icon: 'i-ri-settings-3-line', onClick: () => {} },
  { key: 'logout', title: 'Logout', icon: 'i-ri-logout-box-line', onClick: () => alert('Logout') },
])
</script>

<template>
  <AGUIDemoBlock title="Sidebar Demo">
    <div class="my-4 text-sm">
      activeKey: {{ activeKey }}
    </div>
    <div class="h-100">
      <AGUISidebar v-model:active-key="activeKey" :menu="sidebarMenu" />
    </div>
  </AGUIDemoBlock>
</template>
