<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupChatStore } from '../stores/useGroupChatStore'

const emit = defineEmits<{
  openGroup: [roomId: string]
  createGroup: []
}>()

const { t } = useI18n()
const groupChatStore = useGroupChatStore()

const groupRooms = computed(() => groupChatStore.listRooms())

function getParticipantCount(room: { participantIds: string[] }): number {
  return room.participantIds.length
}
</script>

<template>
  <div class="group-chats-section">
    <div class="group-chats-header">
      <span>💬 {{ t('world.groupChats') }}</span>
      <button
        class="group-chats-create-btn"
        :title="t('world.createGroupChat')"
        @click="emit('createGroup')"
      >
        +
      </button>
    </div>

    <div v-if="groupRooms.length > 0" class="group-chats-list">
      <div
        v-for="room in groupRooms"
        :key="room.id"
        class="group-chat-item"
        @click="emit('openGroup', room.id)"
      >
        <span class="group-chat-item-icon">🗨️</span>
        <div class="group-chat-item-info">
          <div class="group-chat-item-name">
            {{ room.name }}
          </div>
          <div class="group-chat-item-count">
            {{ t('world.participants', { count: getParticipantCount(room) }) }}
          </div>
        </div>
      </div>
    </div>
    <div v-else class="group-chats-empty">
      {{ t('world.noGroupChats') }}
    </div>
  </div>
</template>
