<script setup lang="ts">
import { IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { chatbubbleOutline, globeOutline, layersOutline, personOutline, playOutline } from 'ionicons/icons'
import { onMounted } from 'vue'
import { useResponsive } from '../composables/useResponsive'
import { useStudioStore } from '../stores/useStudioStore'

const studioStore = useStudioStore()
const { isDesktop } = useResponsive()

// Auto-restore last project on page reload (global, runs once for all tabs)
onMounted(() => {
  if (!studioStore.currentProject)
    studioStore.autoRestoreLastProject()
})

const navItems = [
  { tab: 'workspace', href: '/tabs/workspace', icon: layersOutline, label: 'tabs.workspace' },
  { tab: 'chat', href: '/tabs/chat', icon: chatbubbleOutline, label: 'tabs.chat' },
  { tab: 'world', href: '/tabs/world', icon: globeOutline, label: 'tabs.world' },
  { tab: 'play', href: '/tabs/play', icon: playOutline, label: 'tabs.play' },
  { tab: 'me', href: '/tabs/me', icon: personOutline, label: 'tabs.me' },
]
</script>

<template>
  <IonPage>
    <div class="tabs-layout" :class="[{ 'tabs-layout--desktop': isDesktop }]">
      <!-- Desktop sidebar navigation -->
      <nav v-if="isDesktop" class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.tab"
          :to="item.href"
          class="sidebar-nav__item"
          active-class="sidebar-nav__item--active"
        >
          <IonIcon :icon="item.icon" class="sidebar-nav__icon" />
          <span class="sidebar-nav__label">{{ $t(item.label) }}</span>
        </router-link>
      </nav>

      <!-- Main content area -->
      <div class="tabs-layout__main">
        <IonTabs>
          <IonRouterOutlet />
          <!-- Mobile bottom tab bar (hidden on desktop via CSS) -->
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonTabBar slot="bottom" :class="{ 'tab-bar--hidden': isDesktop }">
            <IonTabButton tab="workspace" href="/tabs/workspace">
              <IonIcon aria-hidden="true" :icon="layersOutline" />
              <IonLabel>{{ $t('tabs.workspace') }}</IonLabel>
            </IonTabButton>

            <IonTabButton tab="chat" href="/tabs/chat">
              <IonIcon aria-hidden="true" :icon="chatbubbleOutline" />
              <IonLabel>{{ $t('tabs.chat') }}</IonLabel>
            </IonTabButton>

            <IonTabButton tab="world" href="/tabs/world">
              <IonIcon aria-hidden="true" :icon="globeOutline" />
              <IonLabel>{{ $t('tabs.world') }}</IonLabel>
            </IonTabButton>

            <IonTabButton tab="play" href="/tabs/play">
              <IonIcon aria-hidden="true" :icon="playOutline" />
              <IonLabel>{{ $t('tabs.play') }}</IonLabel>
            </IonTabButton>

            <IonTabButton tab="me" href="/tabs/me">
              <IonIcon aria-hidden="true" :icon="personOutline" />
              <IonLabel>{{ $t('tabs.me') }}</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </div>
    </div>
  </IonPage>
</template>

<style scoped>
.tabs-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs-layout--desktop {
  flex-direction: row;
}

.tabs-layout__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* Hide bottom tabs on desktop */
.tab-bar--hidden {
  display: none !important;
}

/* ── Desktop Sidebar ── */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  width: 72px;
  background: var(--adv-surface-card, #fff);
  border-right: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.08));
  padding: var(--adv-space-sm) 0;
  gap: 2px;
  flex-shrink: 0;
  overflow-y: auto;
}

:root.dark .sidebar-nav {
  background: var(--adv-surface-card, #1e1e2e);
  border-right-color: var(--adv-border-subtle, rgba(255, 255, 255, 0.06));
}

.sidebar-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 4px;
  text-decoration: none;
  color: var(--adv-text-secondary, #666);
  border-radius: var(--adv-radius-md, 8px);
  margin: 0 6px;
  transition:
    background var(--adv-duration-fast, 150ms) ease,
    color var(--adv-duration-fast, 150ms) ease;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-nav__item:hover {
  background: var(--adv-surface-elevated, #f5f5f5);
}

:root.dark .sidebar-nav__item:hover {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.sidebar-nav__item--active {
  color: var(--ion-color-primary, #3880ff);
  background: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.08);
}

.sidebar-nav__icon {
  font-size: 22px;
}

.sidebar-nav__label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
</style>
