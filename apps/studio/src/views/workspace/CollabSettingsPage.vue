<script setup lang="ts">
import type { CollabRole } from '../../stores/useCollabStore'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  personAddOutline,
  personRemoveOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudbaseApp } from '../../composables/useCloudbase'
import { useCollabStore } from '../../stores/useCollabStore'

const { t } = useI18n()
const collabStore = useCollabStore()

let cloudApp: ReturnType<typeof useCloudbaseApp> | null = null
try {
  cloudApp = useCloudbaseApp()
}
catch {
  // CloudBase not available
}

// Invite form state
const inviteUid = ref('')
const inviteDisplayName = ref('')
const inviteRole = ref<CollabRole>('editor')
const isInviting = ref(false)
const inviteError = ref('')

const room = computed(() => collabStore.currentRoom)
const members = computed(() => room.value?.members ?? [])
const onlineUids = computed(() =>
  new Set(collabStore.onlineUsers.filter(u => u.online).map(u => u.uid)),
)

const roleLabelMap: Record<CollabRole, string> = {
  owner: 'collabSettings.roleOwner',
  editor: 'collabSettings.roleEditor',
  viewer: 'collabSettings.roleViewer',
}

const roleColorMap: Record<CollabRole, string> = {
  owner: 'warning',
  editor: 'primary',
  viewer: 'medium',
}

async function handleInvite() {
  if (!cloudApp || !inviteUid.value.trim()) {
    inviteError.value = t('collabSettings.inviteUidRequired')
    return
  }

  isInviting.value = true
  inviteError.value = ''

  const ok = await collabStore.inviteMember(
    cloudApp,
    inviteUid.value.trim(),
    inviteDisplayName.value.trim() || inviteUid.value.trim(),
    inviteRole.value,
  )

  if (ok) {
    inviteUid.value = ''
    inviteDisplayName.value = ''
    inviteRole.value = 'editor'
  }
  else {
    inviteError.value = collabStore.error || t('collabSettings.inviteFailed')
  }
  isInviting.value = false
}

async function handleRemove(uid: string) {
  if (!cloudApp)
    return
  await collabStore.removeMember(cloudApp, uid)
}

async function handleRoleChange(uid: string, newRole: CollabRole) {
  if (!cloudApp)
    return
  await collabStore.updateMemberRole(cloudApp, uid, newRole)
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/workspace" />
        </IonButtons>
        <IonTitle>{{ t('collabSettings.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('collabSettings.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- No Room -->
        <div v-if="!room" class="section-card">
          <p class="empty-hint">
            {{ t('collabSettings.noRoom') }}
          </p>
        </div>

        <!-- Room Info -->
        <template v-else>
          <!-- Members List -->
          <div class="section-card">
            <h3 class="section-card__title">
              <IonIcon :icon="shieldCheckmarkOutline" />
              {{ t('collabSettings.membersTitle', { count: members.length }) }}
            </h3>

            <IonList class="members-list" lines="none">
              <IonItemSliding
                v-for="member in members"
                :key="member.uid"
              >
                <IonItem class="member-item">
                  <!-- Avatar placeholder -->
                  <div slot="start" class="member-avatar" :class="{ 'member-avatar--online': onlineUids.has(member.uid) }">
                    {{ (member.displayName || member.uid).charAt(0).toUpperCase() }}
                  </div>
                  <IonLabel>
                    <h3>{{ member.displayName || member.uid }}</h3>
                    <p class="member-uid">
                      {{ member.uid }}
                    </p>
                  </IonLabel>
                  <!-- Role badge / selector -->
                  <div slot="end" class="member-role-area">
                    <span v-if="onlineUids.has(member.uid)" class="online-dot" />
                    <IonBadge
                      v-if="member.role === 'owner'"
                      :color="roleColorMap[member.role]"
                    >
                      {{ t(roleLabelMap[member.role]) }}
                    </IonBadge>
                    <IonSelect
                      v-else-if="collabStore.isOwner"
                      :value="member.role"
                      interface="popover"
                      @ion-change="handleRoleChange(member.uid, $event.detail.value)"
                    >
                      <IonSelectOption value="editor">
                        {{ t('collabSettings.roleEditor') }}
                      </IonSelectOption>
                      <IonSelectOption value="viewer">
                        {{ t('collabSettings.roleViewer') }}
                      </IonSelectOption>
                    </IonSelect>
                    <IonBadge v-else :color="roleColorMap[member.role]">
                      {{ t(roleLabelMap[member.role]) }}
                    </IonBadge>
                  </div>
                </IonItem>

                <!-- Slide to remove (owner only, can't remove self) -->
                <IonItemOptions
                  v-if="collabStore.isOwner && member.role !== 'owner'"
                  side="end"
                >
                  <IonItemOption color="danger" @click="handleRemove(member.uid)">
                    <IonIcon :icon="personRemoveOutline" />
                    {{ t('collabSettings.remove') }}
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            </IonList>
          </div>

          <!-- Invite Form (owner only) -->
          <div v-if="collabStore.isOwner" class="section-card">
            <h3 class="section-card__title">
              <IonIcon :icon="personAddOutline" />
              {{ t('collabSettings.inviteTitle') }}
            </h3>

            <div class="invite-form">
              <IonInput
                v-model="inviteUid"
                :label="t('collabSettings.uidLabel')"
                label-placement="stacked"
                :placeholder="t('collabSettings.uidPlaceholder')"
                fill="outline"
              />
              <IonInput
                v-model="inviteDisplayName"
                :label="t('collabSettings.nameLabel')"
                label-placement="stacked"
                :placeholder="t('collabSettings.namePlaceholder')"
                fill="outline"
              />
              <IonSelect
                v-model="inviteRole"
                :label="t('collabSettings.roleLabel')"
                label-placement="stacked"
                fill="outline"
                interface="popover"
              >
                <IonSelectOption value="editor">
                  {{ t('collabSettings.roleEditor') }}
                </IonSelectOption>
                <IonSelectOption value="viewer">
                  {{ t('collabSettings.roleViewer') }}
                </IonSelectOption>
              </IonSelect>

              <IonNote v-if="inviteError" color="danger" class="invite-error">
                {{ inviteError }}
              </IonNote>

              <IonButton
                expand="block"
                :disabled="isInviting || !inviteUid.trim()"
                @click="handleInvite"
              >
                <IonIcon slot="start" :icon="personAddOutline" />
                {{ isInviting ? t('collabSettings.inviting') : t('collabSettings.invite') }}
              </IonButton>
            </div>
          </div>
        </template>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}

.section-card {
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.section-card__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
}

.empty-hint {
  text-align: center;
  color: var(--adv-text-tertiary);
  padding: var(--adv-space-xl) 0;
  margin: 0;
}

/* ── Members List ── */
.members-list {
  background: transparent;
  padding: 0;
}

.member-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.member-avatar--online {
  box-shadow: 0 0 0 2px var(--ion-color-success);
}

.member-uid {
  font-size: 12px;
  color: var(--adv-text-tertiary);
}

.member-role-area {
  display: flex;
  align-items: center;
  gap: 6px;
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-success);
  flex-shrink: 0;
}

/* ── Invite Form ── */
.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.invite-error {
  font-size: var(--adv-font-body-sm);
}
</style>
