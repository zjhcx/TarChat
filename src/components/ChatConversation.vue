<script setup lang="ts">
import { computed } from "vue";
import { attachmentLabel, avatarLabel, messageStateIcon, type TimelineEntry } from "../lib/chatUi";
import { formatMessageTime } from "../lib/time";
import type { Attachment, ChatSummary, ChatUser } from "../lib/chatApi";

const props = defineProps<{
  loading: boolean;
  loadingChat: boolean;
  appError: string;
  activeChat: ChatSummary | null;
  selfUser: ChatUser | null;
  usersById: Record<string, ChatUser>;
  timeline: TimelineEntry[];
  presenceText: string;
  draft: string;
  selectedFile: File | null;
  sending: boolean;
  serverOrigin: string;
}>();

const emit = defineEmits<{
  retry: [];
  "update:draft": [string];
  chooseFile: [];
  clearSelectedFile: [];
  send: [];
  openAttachment: [Attachment];
}>();

const activeChatAvatar = computed(() => (props.activeChat ? avatarLabel(props.activeChat) : ""));
</script>

<template>
  <section class="conversation panel">
    <div v-if="loading" class="empty-state">
      <h2>Loading your workspace</h2>
      <p>TarChat is syncing with TarServer.</p>
    </div>

    <div v-else-if="appError && !activeChat" class="empty-state">
      <h2>We could not load your chats</h2>
      <p>{{ appError }}</p>
      <button type="button" class="cta" @click="emit('retry')">Retry</button>
    </div>

    <template v-else-if="activeChat">
      <header class="conversation-header">
        <div class="conversation-heading">
          <div class="avatar avatar-large" :style="{ background: activeChat.accentColor }">
            {{ activeChatAvatar }}
          </div>
          <div>
            <h2>{{ activeChat.title }}</h2>
            <p>{{ presenceText }}</p>
          </div>
        </div>

        <div class="header-actions">
          <button type="button" aria-label="Call">
            <font-awesome-icon icon="phone" />
          </button>
          <button type="button" aria-label="More">
            <font-awesome-icon icon="ellipsis-vertical" />
          </button>
        </div>
      </header>

      <div class="message-pane" :class="{ loading: loadingChat }">
        <template v-for="entry in timeline" :key="entry.id">
          <div v-if="entry.kind === 'divider'" class="day-divider">
            <span>{{ entry.label }}</span>
          </div>

          <article v-else class="message-row" :class="{ own: entry.own }">
            <div
              v-if="!entry.own"
              class="avatar message-avatar"
              :style="{ background: entry.sender?.accentColor ?? '#64748b' }"
            >
              {{ entry.sender?.avatarText ?? "?" }}
            </div>

            <div class="bubble">
              <strong v-if="!entry.own">{{ entry.sender?.name }}</strong>

              <div
                v-if="entry.message.attachment"
                class="attachment-card"
                :class="{ image: entry.message.attachment.kind === 'image' }"
                @click="emit('openAttachment', entry.message.attachment)"
              >
                <img
                  v-if="entry.message.attachment.kind === 'image'"
                  :src="`${serverOrigin}${entry.message.attachment.url}`"
                  :alt="entry.message.attachment.name"
                />
                <div v-else class="attachment-icon">
                  <font-awesome-icon icon="file-lines" />
                </div>
                <div class="attachment-copy">
                  <span>{{ attachmentLabel(entry.message) }}</span>
                  <strong>{{ entry.message.attachment.name }}</strong>
                </div>
              </div>

              <p v-if="entry.message.text">{{ entry.message.text }}</p>

              <div class="bubble-meta">
                <span>{{ formatMessageTime(entry.message.createdAt) }}</span>
                <font-awesome-icon v-if="entry.own" :icon="messageStateIcon(entry.message)" />
              </div>
            </div>
          </article>
        </template>
      </div>

      <form class="composer" @submit.prevent="emit('send')">
        <div class="composer-main">
          <div v-if="selectedFile" class="selected-file">
            <font-awesome-icon :icon="selectedFile.type.startsWith('image/') ? 'image' : 'file-lines'" />
            <span>{{ selectedFile.name }}</span>
            <button type="button" @click="emit('clearSelectedFile')">
              <font-awesome-icon icon="xmark" />
            </button>
          </div>
          <textarea
            :value="draft"
            rows="1"
            placeholder="Write a message"
            @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <button type="button" class="tool-button" aria-label="Attach file" @click="emit('chooseFile')">
          <font-awesome-icon icon="paperclip" />
        </button>
        <button type="submit" class="send-button" :disabled="sending">
          <font-awesome-icon icon="paper-plane" />
        </button>
      </form>
    </template>
  </section>
</template>
