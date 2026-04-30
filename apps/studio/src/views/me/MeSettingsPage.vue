<script setup lang="ts">
import {
  alertController,
  IonIcon,
  toastController,
} from '@ionic/vue'
import {
  cloudOutline,
  colorPaletteOutline,
  globeOutline,
  sparklesOutline,
  trashOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../../components/common/LayoutPage.vue'
import NavGroup from '../../components/ui/NavGroup.vue'
import NavItem from '../../components/ui/NavItem.vue'
import SButton from '../../components/ui/SButton.vue'

const { t } = useI18n()
const router = useRouter()

async function clearCache() {
  const alert = await alertController.create({
    header: t('settings.clearCacheTitle'),
    message: t('settings.clearCacheMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: async () => {
          localStorage.clear()
          const toast = await toastController.create({
            message: t('settings.clearCacheDone'),
            duration: 2000,
            position: 'top',
          })
          await toast.present()
        },
      },
    ],
  })
  await alert.present()
}

const generalItems = [
  {
    key: 'appearance',
    labelKey: 'settings.appearance',
    descKey: 'settings.appearanceDesc',
    icon: colorPaletteOutline,
    color: '--nav-icon-appearance',
    route: '/tabs/me/settings/appearance',
  },
  {
    key: 'language',
    labelKey: 'settings.language',
    descKey: 'settings.languageDesc',
    icon: globeOutline,
    color: '--nav-icon-language',
    route: '/tabs/me/settings/language',
  },
]

const serviceItems = [
  {
    key: 'ai',
    labelKey: 'settings.ai',
    descKey: 'settings.aiDesc',
    icon: sparklesOutline,
    color: '--nav-icon-ai',
    route: '/tabs/me/settings/ai',
  },
  {
    key: 'cloudSync',
    labelKey: 'settings.cloudSync',
    descKey: 'settings.cloudSyncDesc',
    icon: cloudOutline,
    color: '--nav-icon-cloud',
    route: '/tabs/me/settings/cloud',
  },
]
</script>

<template>
  <LayoutPage :title="t('me.settings')" show-back-button default-href="/tabs/me">
    <div class="page-container">
      <!-- General: Appearance & Language -->
      <NavGroup>
        <NavItem
          v-for="item in generalItems"
          :key="item.key"
          :icon="item.icon"
          :icon-color="`var(${item.color})`"
          :label="t(item.labelKey)"
          :desc="t(item.descKey)"
          @click="router.push(item.route)"
        />
      </NavGroup>

      <!-- Services: AI & Cloud Sync -->
      <NavGroup>
        <NavItem
          v-for="item in serviceItems"
          :key="item.key"
          :icon="item.icon"
          :icon-color="`var(${item.color})`"
          :label="t(item.labelKey)"
          :desc="t(item.descKey)"
          @click="router.push(item.route)"
        />
      </NavGroup>

      <!-- Danger Zone -->
      <div class="danger-section">
        <SButton variant="danger" block @click="clearCache">
          <IonIcon :icon="trashOutline" />
          <span>{{ t('settings.clearCache') }}</span>
        </SButton>
      </div>
    </div>
  </LayoutPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-sm) var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  max-width: 560px;
  margin: 0 auto;

  --nav-icon-ai: var(--adv-primary);
  --nav-icon-appearance: #f59e0b;
  --nav-icon-language: #10b981;
  --nav-icon-cloud: var(--adv-primary);
}

/* ── Danger Section ── */
.danger-section {
  padding-top: var(--adv-space-sm);
}
</style>
