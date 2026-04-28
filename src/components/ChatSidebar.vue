<script setup lang="ts">
import { previewLine, avatarLabel } from "../lib/chatUi";
import { formatSidebarTime } from "../lib/time";
import type { ChatSummary, ChatUser } from "../lib/chatApi";

defineProps<{
  selfUser: ChatUser | null;
  search: string;
  chats: ChatSummary[];
  selectedChatId: string;
}>();

const emit = defineEmits<{
  "update:search": [string];
  selectChat: [string];
  createGroup: [];
  signOut: [];
}>();
</script>

<template>
  <aside class="sidebar panel">
    <div class="profile-card">
      <div class="avatar avatar-large" :style="{ background: selfUser?.accentColor }">
        {{ selfUser?.avatarText }}
      </div>
      <div class="profile-copy">
        <h1>{{ selfUser?.name }}</h1>
        <p>{{ selfUser?.about }}</p>
        <small>{{ selfUser?.handle }}</small>
      </div>
      <button type="button" class="signout-button" @click="emit('signOut')">
        <font-awesome-icon icon="right-from-bracket" />
      </button>
    </div>

    <label class="searchbar">
      <font-awesome-icon icon="magnifying-glass" />
      <input
        :value="search"
        type="text"
        placeholder="Search chats"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <button type="button" class="cta sidebar-cta" @click="emit('createGroup')">
      <font-awesome-icon icon="users" />
      <span>New Group</span>
    </button>

    <div class="chat-list">
      <button
        v-for="chat in chats"
        :key="chat.id"
        type="button"
        class="chat-card"
        :class="{ selected: chat.id === selectedChatId }"
        @click="emit('selectChat', chat.id)"
      >
        <div class="avatar" :style="{ background: chat.accentColor }">
          {{ avatarLabel(chat) }}
        </div>
        <div class="chat-copy">
          <div class="chat-row">
            <strong>{{ chat.title }}</strong>
            <span>{{ formatSidebarTime(chat.lastActivityAt) }}</span>
          </div>
          <div class="chat-row chat-row-muted">
            <span>{{ previewLine(chat) }}</span>
            <span v-if="chat.unreadCount" class="unread-badge">{{ chat.unreadCount }}</span>
          </div>
        </div>
      </button>
    </div>
  </aside>
</template>
