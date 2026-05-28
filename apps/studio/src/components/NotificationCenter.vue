<script setup lang="ts">
import type { NotificationRecord } from '../stores/useNotificationsStore'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  checkmarkDoneOutline,
  closeOutline,
  notificationsOffOutline,
  personAddOutline,
  sparklesOutline,
} from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCloudbase } from '../composables/useCloudbase'
import { useNotificationsStore } from '../stores/useNotificationsStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const router = useRouter()
const store = useNotificationsStore()
const { notifications, isLoading, unreadCount } = storeToRefs(store)

let cloudApp: ReturnType<typeof useCloudbase>['app'] | null = null
try {
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

watch(() => props.open, async (open) => {
  if (open && cloudApp)
    await store.load(cloudApp)
})

const hasNotifications = computed(() => notifications.value.length > 0)

function close() {
  emit('update:open', false)
}

function iconFor(type: NotificationRecord['type']) {
  switch (type) {
    case 'new_project': return sparklesOutline
    case 'follow_received': return personAddOutline
    default: return sparklesOutline
  }
}

function labelFor(n: NotificationRecord): string {
  const actor = n.payload.actorName ?? t('notifications.someone')
  switch (n.type) {
    case 'new_project':
      return t('notifications.newProject', {
        actor,
        project: n.payload.projectName ?? '—',
      })
    case 'follow_received':
      return t('notifications.followReceived', { actor })
    default:
      return ''
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1)
    return t('notifications.justNow')
  if (m < 60)
    return t('notifications.minutesAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24)
    return t('notifications.hoursAgo', { n: h })
  const d = Math.floor(h / 24)
  return t('notifications.daysAgo', { n: d })
}

async function handleClick(n: NotificationRecord) {
  if (cloudApp && n._id)
    await store.markRead(cloudApp, n._id)
  // Navigate based on type. `new_project` jumps to Marketplace with the
  // record pre-focussed; the Marketplace page reads `?market=<id>` to open
  // the detail modal if present. `follow_received` jumps to the follower's
  // profile.
  if (n.type === 'new_project' && n.refId) {
    router.push({ path: '/tabs/workspace/marketplace', query: { market: n.refId } })
    close()
  }
  else if (n.type === 'follow_received' && n.payload.actorId) {
    router.push(`/creator/${n.payload.actorId}`)
    close()
  }
}

async function handleMarkAll() {
  if (cloudApp)
    await store.markAllRead(cloudApp)
}
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          {{ t('notifications.title') }}
          <span v-if="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
        </IonTitle>
        <IonButtons slot="end">
          <IonButton v-if="unreadCount > 0" fill="clear" size="small" @click="handleMarkAll">
            <IonIcon slot="start" :icon="checkmarkDoneOutline" />
            {{ t('notifications.markAllRead') }}
          </IonButton>
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding-vertical">
      <div v-if="isLoading && !hasNotifications" class="state">
        <IonSpinner name="crescent" />
      </div>
      <div v-else-if="!hasNotifications" class="state">
        <IonIcon :icon="notificationsOffOutline" />
        <p>{{ t('notifications.empty') }}</p>
      </div>
      <ul v-else class="notification-list">
        <li
          v-for="n in notifications"
          :key="n._id"
          class="notification-item"
          :class="{ 'notification-item--unread': !n.read }"
        >
          <button
            type="button"
            class="notification-item__button"
            @click="handleClick(n)"
          >
            <span class="notification-item__icon">
              <IonIcon :icon="iconFor(n.type)" />
            </span>
            <span class="notification-item__body">
              <span class="notification-item__text">{{ labelFor(n) }}</span>
              <span class="notification-item__time">{{ relativeTime(n.createdAt) }}</span>
            </span>
            <span v-if="!n.read" class="notification-item__dot" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  margin-left: 6px;
  border-radius: 9px;
  background: var(--ion-color-danger);
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--adv-text-secondary);
}

.state ion-icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
}

.notification-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-item {
  border-bottom: 1px solid var(--adv-border-subtle);
}

.notification-item__button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: background 0.12s ease;
}

.notification-item__button:hover {
  background: var(--adv-surface-elevated);
}

.notification-item--unread .notification-item__button {
  background: rgba(99, 102, 241, 0.04);
}

.notification-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: var(--adv-surface-elevated);
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.notification-item__icon ion-icon {
  font-size: 18px;
}

.notification-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notification-item__text {
  font-size: var(--adv-font-body);
  color: var(--adv-text-primary);
  line-height: 1.35;
}

.notification-item__time {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.notification-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--ion-color-primary);
  flex-shrink: 0;
}
</style>
