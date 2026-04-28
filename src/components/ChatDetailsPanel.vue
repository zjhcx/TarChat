<script setup lang="ts">
import { computed } from "vue";
import { avatarLabel } from "../lib/chatUi";
import { formatLastSeen, formatSidebarTime } from "../lib/time";
import type { Attachment, ChatMember, ChatSummary, ChatUser, GroupFile } from "../lib/chatApi";

type DetailsTab = "info" | "settings" | "files";

const props = defineProps<{
  selfUser: ChatUser | null;
  activeChat: ChatSummary | null;
  activeParticipants: ChatMember[];
  activeFiles: GroupFile[];
  activeMessagesWithAttachments: number;
  announcementDraft: string;
  canManageGroup: boolean;
  isGroupOwner: boolean;
  inviteableUsers: ChatUser[];
  detailsTab: DetailsTab;
}>();

const emit = defineEmits<{
  "update:detailsTab": [DetailsTab];
  "update:announcementDraft": [string];
  openAttachment: [Attachment];
  saveAnnouncement: [];
  toggleLock: [boolean];
  dissolveGroup: [];
  addMember: [string];
  changeMemberRole: [string, string];
  handoffOwnership: [string];
  removeMember: [string];
}>();

const activeChatAvatar = computed(() => (props.activeChat ? avatarLabel(props.activeChat) : ""));
const showSettingsTab = computed(() => props.activeChat?.kind === "group");
</script>

<template>
  <aside v-if="activeChat" class="details panel">
    <div class="details-top">
      <div class="avatar avatar-large" :style="{ background: activeChat.accentColor }">
        {{ activeChatAvatar }}
      </div>
      <h3>{{ activeChat.title }}</h3>
      <p>{{ activeChat.description }}</p>
    </div>

    <div class="details-tabs">
      <button
        type="button"
        class="details-tab-button"
        :class="{ active: detailsTab === 'info' }"
        @click="emit('update:detailsTab', 'info')"
      >
        Info
      </button>
      <button
        v-if="showSettingsTab"
        type="button"
        class="details-tab-button"
        :class="{ active: detailsTab === 'settings' }"
        @click="emit('update:detailsTab', 'settings')"
      >
        Settings
      </button>
      <button
        v-if="showSettingsTab"
        type="button"
        class="details-tab-button"
        :class="{ active: detailsTab === 'files' }"
        @click="emit('update:detailsTab', 'files')"
      >
        Files
      </button>
    </div>

    <div v-if="detailsTab === 'info'" class="details-scroll">
      <div class="stats-grid">
        <div class="stat-card">
          <font-awesome-icon icon="users" />
          <strong>{{ activeParticipants.length }}</strong>
          <span>Members</span>
        </div>
        <div class="stat-card">
          <font-awesome-icon icon="comments" />
          <strong>{{ activeChat.unreadCount }}</strong>
          <span>Unread</span>
        </div>
        <div class="stat-card">
          <font-awesome-icon icon="image" />
          <strong>{{ activeMessagesWithAttachments }}</strong>
          <span>Media</span>
        </div>
      </div>

      <div class="member-list">
        <div class="section-title">People</div>
        <article v-for="member in activeParticipants" :key="member.id" class="member-card">
          <div class="avatar" :style="{ background: member.accentColor }">
            {{ member.avatarText }}
          </div>
          <div class="member-copy">
            <strong>{{ member.name }}</strong>
            <span>
              {{ member.memberRole }} · {{ member.status === "online" ? "online" : formatLastSeen(member.lastSeenAt) }}
            </span>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="detailsTab === 'settings'" class="details-scroll">
      <div v-if="activeChat.kind === 'group'" class="group-panel">
        <div class="section-title">Announcement</div>
        <textarea
          :value="announcementDraft"
          class="announcement-input"
          :readonly="!isGroupOwner"
          placeholder="Group announcement"
          @input="emit('update:announcementDraft', ($event.target as HTMLTextAreaElement).value)"
        />
        <button v-if="isGroupOwner" type="button" class="cta compact-cta" @click="emit('saveAnnouncement')">
          Save announcement
        </button>

        <div class="section-title">Group Controls</div>
        <div class="group-actions">
          <button
            v-if="isGroupOwner"
            type="button"
            class="cta compact-cta"
            @click="emit('toggleLock', !activeChat.locked)"
          >
            {{ activeChat.locked ? "Unlock Group" : "Lock Group" }}
          </button>
          <button
            v-if="isGroupOwner"
            type="button"
            class="cta compact-cta danger-cta"
            @click="emit('dissolveGroup')"
          >
            Dissolve Group
          </button>
        </div>

        <div class="section-title">Invite People</div>
        <div v-if="canManageGroup && inviteableUsers.length" class="invite-list">
          <button
            v-for="candidate in inviteableUsers"
            :key="candidate.id"
            type="button"
            class="invite-chip"
            @click="emit('addMember', candidate.id)"
          >
            <span>{{ candidate.name }}</span>
            <font-awesome-icon icon="user-plus" />
          </button>
        </div>

        <div class="section-title">Member Permissions</div>
        <div class="member-list settings-member-list">
          <article v-for="member in activeParticipants" :key="member.id" class="member-card">
            <div class="avatar" :style="{ background: member.accentColor }">
              {{ member.avatarText }}
            </div>
            <div class="member-copy">
              <strong>{{ member.name }}</strong>
              <span>
                {{ member.memberRole }} · {{ member.status === "online" ? "online" : formatLastSeen(member.lastSeenAt) }}
              </span>
            </div>
            <div v-if="member.id !== selfUser?.id" class="member-actions">
              <button
                v-if="isGroupOwner && member.memberRole !== 'owner'"
                type="button"
                class="mini-action"
                @click="emit('changeMemberRole', member.id, member.memberRole === 'admin' ? 'member' : 'admin')"
              >
                {{ member.memberRole === "admin" ? "Demote" : "Promote" }}
              </button>
              <button
                v-if="isGroupOwner && !activeChat.locked"
                type="button"
                class="mini-action"
                @click="emit('handoffOwnership', member.id)"
              >
                Transfer
              </button>
              <button
                v-if="(isGroupOwner || (canManageGroup && member.memberRole === 'member')) && !activeChat.locked"
                type="button"
                class="mini-action danger-text"
                @click="emit('removeMember', member.id)"
              >
                Remove
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <div v-else class="details-scroll">
      <div class="file-browser">
        <div class="section-title">Group Files</div>
        <button
          v-for="file in activeFiles"
          :key="file.messageId"
          type="button"
          class="file-row"
          @click="emit('openAttachment', file.attachment)"
        >
          <font-awesome-icon :icon="file.attachment.kind === 'image' ? 'image' : 'file-lines'" />
          <div class="file-copy">
            <strong>{{ file.attachment.name }}</strong>
            <span>{{ file.senderName }} · {{ formatSidebarTime(file.createdAt) }}</span>
          </div>
        </button>
        <p v-if="!activeFiles.length" class="empty-mini">No shared files yet.</p>
      </div>
    </div>
  </aside>
</template>
