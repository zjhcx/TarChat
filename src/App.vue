<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  addChatMember,
  clearStoredToken,
  createGroupChat,
  createSocketUrl,
  dissolveGroupChat,
  fetchBootstrap,
  fetchChatDetail,
  fetchUsers,
  getAttachmentOpenUrl,
  getServerOrigin,
  getStoredToken,
  login,
  logout,
  markChatRead,
  removeChatMember,
  register,
  sendMessage,
  setChatLocked,
  setStoredToken,
  transferOwnership,
  updateAnnouncement,
  updateMemberRole,
  type Attachment,
  type BootstrapPayload,
  type ChatDetailPayload,
  type ChatEventPayload,
  type ChatMember,
  type ChatSummary,
  type ChatUser,
  type GroupFile,
} from "./lib/chatApi";
import { buildTimeline } from "./lib/chatUi";
import { formatLastSeen } from "./lib/time";
import AuthScreen from "./components/AuthScreen.vue";
import ChatConversation from "./components/ChatConversation.vue";
import ChatDetailsPanel from "./components/ChatDetailsPanel.vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import GroupCreatorModal from "./components/GroupCreatorModal.vue";
import TitleBar from "./components/TitleBar.vue";

type AuthMode = "login" | "register";
type DetailsTab = "info" | "settings" | "files";

const appWindow = getCurrentWindow();
const socket = ref<WebSocket | null>(null);
const bootstrap = ref<BootstrapPayload | null>(null);
const chats = ref<ChatSummary[]>([]);
const activeDetail = ref<ChatDetailPayload | null>(null);
const availableUsers = ref<ChatUser[]>([]);
const selectedChatId = ref("");
const search = ref("");
const draft = ref("");
const selectedFile = ref<File | null>(null);
const groupTitle = ref("");
const groupDescription = ref("");
const groupMemberIds = ref<string[]>([]);
const announcementDraft = ref("");
const detailsTab = ref<DetailsTab>("info");
const loading = ref(false);
const loadingChat = ref(false);
const sending = ref(false);
const savingGroup = ref(false);
const authMode = ref<AuthMode>("login");
const authHandle = ref("jiahui");
const authPassword = ref("tar123456");
const authError = ref("");
const appError = ref("");
const connectionState = ref<"offline" | "connecting" | "online">("offline");
const fileInput = ref<HTMLInputElement | null>(null);
const showGroupCreator = ref(false);

function sortChats(next: ChatSummary[]) {
  next.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });
}

function resetAppState() {
  bootstrap.value = null;
  chats.value = [];
  activeDetail.value = null;
  availableUsers.value = [];
  selectedChatId.value = "";
  search.value = "";
  draft.value = "";
  selectedFile.value = null;
  announcementDraft.value = "";
  detailsTab.value = "info";
  appError.value = "";
  closeSocket();
}

async function hydrateApp() {
  loading.value = true;
  appError.value = "";

  try {
    const payload = await fetchBootstrap();
    const userPayload = await fetchUsers();
    bootstrap.value = payload;
    availableUsers.value = userPayload.users;
    chats.value = [...payload.chats];
    sortChats(chats.value);

    if (!selectedChatId.value && payload.chats.length > 0) {
      selectedChatId.value = payload.chats[0].id;
    }

    if (selectedChatId.value) {
      await openChat(selectedChatId.value);
    }

    connectSocket();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load data.";
    appError.value = message;
    if (message.includes("401") || message.includes("unauthorized")) {
      clearSession();
    }
  } finally {
    loading.value = false;
  }
}

async function submitAuth(payload: { name: string; handle: string; password: string }) {
  authError.value = "";
  authHandle.value = payload.handle;
  authPassword.value = payload.password;

  try {
    const result =
      authMode.value === "login"
        ? await login(payload.handle, payload.password)
        : await register(payload.name, payload.handle, payload.password);

    setStoredToken(result.token);
    authPassword.value = "";
    resetAppState();
    await hydrateApp();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Authentication failed.";
  }
}

async function signOut() {
  try {
    await logout();
  } catch {
    // Ignore logout failures and clear the session locally.
  }
  clearSession();
}

function clearSession() {
  clearStoredToken();
  resetAppState();
  connectionState.value = "offline";
  authMode.value = "login";
}

async function openChat(chatId: string) {
  if (!bootstrap.value) {
    return;
  }

  selectedChatId.value = chatId;
  loadingChat.value = true;
  try {
    const detail = await fetchChatDetail(chatId);
    activeDetail.value = detail;
    announcementDraft.value = detail.chat.announcement;
    detailsTab.value = detail.chat.kind === "group" ? "info" : "info";
    upsertChat(detail.chat);
    await acknowledgeRead(chatId);
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to open chat.";
  } finally {
    loadingChat.value = false;
  }
}

async function acknowledgeRead(chatId: string) {
  try {
    const payload = await markChatRead(chatId);
    upsertChat(payload.chat);
    if (activeDetail.value?.chat.id === chatId) {
      activeDetail.value = { ...activeDetail.value, chat: payload.chat };
    }
  } catch {
    // Keep the UI responsive even if read state lags behind.
  }
}

async function submitMessage() {
  if (!selectedChatId.value || sending.value) {
    return;
  }

  const text = draft.value.trim();
  if (!text && !selectedFile.value) {
    return;
  }

  sending.value = true;
  const file = selectedFile.value;
  draft.value = "";
  selectedFile.value = null;

  try {
    const payload = await sendMessage(selectedChatId.value, text, file);
    applyIncomingEvent("message.created", payload);
  } catch (error) {
    draft.value = text;
    selectedFile.value = file;
    appError.value = error instanceof Error ? error.message : "Failed to send message.";
  } finally {
    sending.value = false;
  }
}

async function submitGroupCreation() {
  if (savingGroup.value) {
    return;
  }

  savingGroup.value = true;
  try {
    const detail = await createGroupChat(
      groupTitle.value,
      groupDescription.value,
      groupMemberIds.value,
    );
    showGroupCreator.value = false;
    groupTitle.value = "";
    groupDescription.value = "";
    groupMemberIds.value = [];
    upsertChat(detail.chat);
    await openChat(detail.chat.id);
    detailsTab.value = "settings";
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to create group.";
  } finally {
    savingGroup.value = false;
  }
}

async function saveAnnouncement() {
  if (!activeChat.value) {
    return;
  }
  try {
    const payload = await updateAnnouncement(activeChat.value.id, announcementDraft.value);
    upsertChat(payload.chat);
    if (activeDetail.value?.chat.id === activeChat.value.id) {
      activeDetail.value = { ...activeDetail.value, chat: payload.chat };
    }
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to update announcement.";
  }
}

async function toggleLock(locked: boolean) {
  if (!activeChat.value) {
    return;
  }
  try {
    const payload = await setChatLocked(activeChat.value.id, locked);
    upsertChat(payload.chat);
    if (activeDetail.value?.chat.id === activeChat.value.id) {
      activeDetail.value = { ...activeDetail.value, chat: payload.chat };
    }
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to update lock state.";
  }
}

async function addMember(userId: string) {
  if (!activeChat.value) {
    return;
  }
  try {
    const detail = await addChatMember(activeChat.value.id, userId);
    activeDetail.value = detail;
    upsertChat(detail.chat);
    detailsTab.value = "settings";
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to add member.";
  }
}

async function removeMember(userId: string) {
  if (!activeChat.value) {
    return;
  }
  try {
    const detail = await removeChatMember(activeChat.value.id, userId);
    activeDetail.value = detail;
    upsertChat(detail.chat);
    detailsTab.value = "settings";
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to remove member.";
  }
}

async function changeMemberRole(userId: string, role: string) {
  if (!activeChat.value) {
    return;
  }
  try {
    const detail = await updateMemberRole(activeChat.value.id, userId, role);
    activeDetail.value = detail;
    upsertChat(detail.chat);
    detailsTab.value = "settings";
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to update member role.";
  }
}

async function handoffOwnership(userId: string) {
  if (!activeChat.value) {
    return;
  }
  try {
    const detail = await transferOwnership(activeChat.value.id, userId);
    activeDetail.value = detail;
    upsertChat(detail.chat);
    detailsTab.value = "settings";
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to transfer ownership.";
  }
}

async function dissolveActiveGroup() {
  if (!activeChat.value) {
    return;
  }
  try {
    const dissolvedChatId = activeChat.value.id;
    await dissolveGroupChat(dissolvedChatId);
    chats.value = chats.value.filter((chat) => chat.id !== dissolvedChatId);
    activeDetail.value = null;
    selectedChatId.value = chats.value[0]?.id ?? "";
    detailsTab.value = "info";
    if (selectedChatId.value) {
      await openChat(selectedChatId.value);
    }
  } catch (error) {
    appError.value = error instanceof Error ? error.message : "Failed to dissolve group.";
  }
}

function connectSocket() {
  closeSocket();

  const token = getStoredToken();
  if (!token) {
    connectionState.value = "offline";
    return;
  }

  connectionState.value = "connecting";
  const ws = new WebSocket(createSocketUrl(token));
  socket.value = ws;

  ws.onopen = () => {
    connectionState.value = "online";
  };

  ws.onclose = () => {
    connectionState.value = "offline";
  };

  ws.onerror = () => {
    connectionState.value = "offline";
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { type: string; data: ChatEventPayload | { reason?: string } };
      if (payload.type === "session.closed") {
        clearSession();
        return;
      }
      applyIncomingEvent(payload.type, payload.data as ChatEventPayload);
    } catch {
      // Ignore malformed events.
    }
  };
}

function closeSocket() {
  if (socket.value) {
    socket.value.close();
    socket.value = null;
  }
}

function applyIncomingEvent(type: string, payload: ChatEventPayload) {
  if (payload.chat) {
    upsertChat(payload.chat);
  }

  if (type === "message.created" && payload.message && activeDetail.value?.chat.id === payload.chat.id) {
    if (!activeDetail.value.messages.some((message) => message.id === payload.message?.id)) {
      activeDetail.value = {
        ...activeDetail.value,
        chat: payload.chat,
        messages: [...activeDetail.value.messages, payload.message],
        files: payload.message.attachment
          ? [
              {
                attachment: payload.message.attachment,
                messageId: payload.message.id,
                chatId: payload.message.chatId,
                senderId: payload.message.senderId,
                senderName: usersById.value[payload.message.senderId]?.name ?? "Unknown",
                createdAt: payload.message.createdAt,
              },
              ...activeDetail.value.files,
            ]
          : activeDetail.value.files,
      };
    }
    if (payload.message.senderId !== bootstrap.value?.self.id) {
      void acknowledgeRead(payload.chat.id);
    }
  }

  if ((type === "chat.read" || type === "chat.updated" || type === "chat.created") && activeDetail.value?.chat.id === payload.chat.id) {
    activeDetail.value = {
      ...activeDetail.value,
      chat: payload.chat,
    };
  }

  if (type === "chat.membership" && activeDetail.value?.chat.id === payload.chat.id) {
    void openChat(payload.chat.id);
  }

  if (type === "chat.dissolved" && activeDetail.value?.chat.id === (payload as { chatId?: string }).chatId) {
    chats.value = chats.value.filter((chat) => chat.id !== activeDetail.value?.chat.id);
    activeDetail.value = null;
  }
}

function upsertChat(summary: ChatSummary) {
  const next = [...chats.value];
  const index = next.findIndex((chat) => chat.id === summary.id);
  if (index >= 0) {
    next[index] = summary;
  } else {
    next.push(summary);
  }
  sortChats(next);
  chats.value = next;
}

function chooseFile() {
  fileInput.value?.click();
}

function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  input.value = "";
}

function clearSelectedFile() {
  selectedFile.value = null;
}

function openAttachment(attachment?: Attachment) {
  if (!attachment) {
    return;
  }
  window.open(getAttachmentOpenUrl(attachment.id), "_blank", "noopener,noreferrer");
}

const selfUser = computed(() => bootstrap.value?.self ?? null);
const usersById = computed<Record<string, ChatUser>>(() => bootstrap.value?.users ?? {});
const activeChat = computed(() => activeDetail.value?.chat ?? null);
const activeParticipants = computed<ChatMember[]>(() => activeDetail.value?.participants ?? []);
const activeFiles = computed<GroupFile[]>(() => activeDetail.value?.files ?? []);
const activeMessagesWithAttachments = computed(
  () => activeDetail.value?.messages.filter((message) => message.attachment).length ?? 0,
);
const canManageGroup = computed(
  () =>
    activeChat.value?.kind === "group" &&
    (activeChat.value.selfMemberRole === "owner" || activeChat.value.selfMemberRole === "admin"),
);
const isGroupOwner = computed(
  () => activeChat.value?.kind === "group" && activeChat.value.selfMemberRole === "owner",
);
const inviteableUsers = computed(() => {
  const memberIds = new Set(activeChat.value?.memberIds ?? []);
  return availableUsers.value.filter((user) => !memberIds.has(user.id));
});

const visibleChats = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) {
    return chats.value;
  }
  return chats.value.filter((chat) => {
    const preview = chat.lastMessage?.text.toLowerCase() ?? "";
    return (
      chat.title.toLowerCase().includes(keyword) ||
      chat.description.toLowerCase().includes(keyword) ||
      preview.includes(keyword)
    );
  });
});

const presenceText = computed(() => {
  if (!activeChat.value) {
    return "Choose a chat to begin.";
  }
  if (activeChat.value.kind === "saved") {
    return "Private notes and files.";
  }
  if (activeChat.value.kind === "direct") {
    const peer = activeParticipants.value.find((member) => member.id !== selfUser.value?.id);
    if (!peer) {
      return "Private conversation";
    }
    return peer.status === "online" ? "online now" : formatLastSeen(peer.lastSeenAt);
  }
  return `${activeParticipants.value.length} members, ${activeChat.value.onlineMemberIds.length} online`;
});

const timeline = computed(() =>
  buildTimeline(activeDetail.value?.messages ?? [], usersById.value, selfUser.value?.id),
);

watch(
  () => activeChat.value?.kind,
  (kind) => {
    if (kind !== "group" && detailsTab.value !== "info") {
      detailsTab.value = "info";
    }
  },
);

async function minimize() {
  await appWindow.minimize();
}

async function maximize() {
  await appWindow.toggleMaximize();
}

async function closeWindow() {
  await appWindow.close();
}

onMounted(() => {
  if (getStoredToken()) {
    void hydrateApp();
  }
});

onBeforeUnmount(() => {
  closeSocket();
});
</script>

<template>
  <main class="app-shell">
    <TitleBar
      :connected="Boolean(bootstrap)"
      :connection-state="connectionState"
      @minimize="minimize"
      @maximize="maximize"
      @close="closeWindow"
    />

    <AuthScreen
      v-if="!bootstrap"
      v-model:auth-mode="authMode"
      :auth-error="authError"
      :default-handle="authHandle"
      :default-password="authPassword"
      @submit="submitAuth"
    />

    <section v-else class="workspace">
      <ChatSidebar
        :self-user="selfUser"
        :search="search"
        :chats="visibleChats"
        :selected-chat-id="selectedChatId"
        @update:search="search = $event"
        @select-chat="openChat"
        @create-group="showGroupCreator = true"
        @sign-out="signOut"
      />

      <section class="conversation-wrap">
        <ChatConversation
          :loading="loading"
          :loading-chat="loadingChat"
          :app-error="appError"
          :active-chat="activeChat"
          :self-user="selfUser"
          :users-by-id="usersById"
          :timeline="timeline"
          :presence-text="presenceText"
          :draft="draft"
          :selected-file="selectedFile"
          :sending="sending"
          :server-origin="getServerOrigin()"
          @retry="hydrateApp"
          @update:draft="draft = $event"
          @choose-file="chooseFile"
          @clear-selected-file="clearSelectedFile"
          @send="submitMessage"
          @open-attachment="openAttachment"
        />
        <input ref="fileInput" type="file" hidden @change="onPickFile" />
      </section>

      <ChatDetailsPanel
        :self-user="selfUser"
        :active-chat="activeChat"
        :active-participants="activeParticipants"
        :active-files="activeFiles"
        :active-messages-with-attachments="activeMessagesWithAttachments"
        :announcement-draft="announcementDraft"
        :can-manage-group="canManageGroup"
        :is-group-owner="isGroupOwner"
        :inviteable-users="inviteableUsers"
        :details-tab="detailsTab"
        @update:details-tab="detailsTab = $event"
        @update:announcement-draft="announcementDraft = $event"
        @open-attachment="openAttachment"
        @save-announcement="saveAnnouncement"
        @toggle-lock="toggleLock"
        @dissolve-group="dissolveActiveGroup"
        @add-member="addMember"
        @change-member-role="changeMemberRole"
        @handoff-ownership="handoffOwnership"
        @remove-member="removeMember"
      />
    </section>

    <GroupCreatorModal
      :open="showGroupCreator"
      :title="groupTitle"
      :description="groupDescription"
      :member-ids="groupMemberIds"
      :users="availableUsers"
      :saving="savingGroup"
      @close="showGroupCreator = false"
      @submit="submitGroupCreation"
      @update:title="groupTitle = $event"
      @update:description="groupDescription = $event"
      @update:member-ids="groupMemberIds = $event"
    />
  </main>
</template>

<style>
:root {
  font-family: "SF Pro Display", "IBM Plex Sans", "PingFang SC", sans-serif;
  color: #e8eef7;
  background:
    radial-gradient(circle at top left, rgba(58, 123, 213, 0.34), transparent 28%),
    radial-gradient(circle at top right, rgba(98, 196, 255, 0.18), transparent 24%),
    linear-gradient(180deg, #0f1724 0%, #09111d 100%);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
  background: transparent !important;
}

body {
  min-height: 100vh;
  overflow: hidden;
}

button,
input,
textarea {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

.app-shell {
  height: 100vh;
  overflow: hidden;
  padding: 56px 18px 18px;
}

.panel {
  border: 1px solid rgba(153, 175, 199, 0.12);
  border-radius: 20px;
  background: rgba(7, 14, 24, 0.72);
  box-shadow: 0 20px 50px rgba(1, 6, 15, 0.34);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}

.window-controls,
.window-controls button {
  -webkit-app-region: no-drag;
}

.window-controls {
  display: inline-flex;
  gap: 6px;
}

.window-controls button,
.header-actions button,
.cta,
.send-button,
.tool-button,
.signout-button,
.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #edf6ff;
  transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
}

.window-controls button {
  width: 34px;
  height: 28px;
}

.window-controls button:hover,
.header-actions button:hover,
.cta:hover,
.send-button:hover,
.tool-button:hover,
.signout-button:hover,
.modal-close:hover,
.chat-card:hover,
.details-tab-button:hover,
.mini-action:hover,
.file-row:hover,
.invite-chip:hover {
  background: rgba(91, 184, 255, 0.22);
  transform: translateY(-1px);
}

.auth-shell {
  min-height: calc(100vh - 74px);
  display: grid;
  place-items: center;
}

.auth-card {
  width: min(460px, 100%);
  padding: 28px;
  display: grid;
  gap: 18px;
}

.auth-copy h1,
.profile-copy h1,
.conversation-heading h2,
.details-top h3 {
  margin: 0;
  font-size: 28px;
}

.auth-copy p,
.profile-copy p,
.conversation-heading p,
.details-top p,
.empty-state p {
  margin: 6px 0 0;
  color: #9cb0c5;
  line-height: 1.5;
}

.auth-copy small,
.profile-copy small {
  color: #7f93a8;
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.auth-tabs button {
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #9eb3c7;
}

.auth-tabs button.active,
.details-tab-button.active {
  background: rgba(92, 184, 255, 0.18);
  color: #edf6ff;
}

.auth-form {
  display: grid;
  gap: 12px;
}

.auth-form input,
.searchbar input,
.composer textarea {
  width: 100%;
  border: 0;
  outline: none;
  color: #edf6ff;
  background: transparent;
}

.auth-form input {
  height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.auth-form input::placeholder,
.searchbar input::placeholder,
.composer textarea::placeholder {
  color: #6c8197;
}

.error-text {
  margin: 0;
  color: #ff9a8f;
}

.cta {
  gap: 10px;
  min-height: 46px;
}

.workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 320px;
  gap: 16px;
  height: calc(100vh - 74px);
  min-height: 0;
}

.sidebar,
.details {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  overflow: hidden;
}

.profile-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(92, 184, 255, 0.24), rgba(114, 230, 200, 0.18));
}

.profile-copy {
  min-width: 0;
}

.signout-button {
  width: 40px;
  height: 40px;
}

.searchbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  color: #8ea3b8;
}

.sidebar-cta {
  width: 100%;
  min-height: 44px;
  gap: 10px;
}

.chat-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.chat-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  background: transparent;
  color: inherit;
  text-align: left;
}

.chat-card.selected {
  background: rgba(91, 184, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(91, 184, 255, 0.15);
}

.chat-copy {
  min-width: 0;
}

.chat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-row strong,
.chat-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-row span {
  color: #90a4b9;
  font-size: 12px;
}

.chat-row-muted {
  margin-top: 6px;
}

.unread-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: #5cb8ff;
  color: #08121d !important;
  line-height: 22px;
  text-align: center;
  font-weight: 700;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  color: #06101a;
  font-weight: 800;
}

.avatar-large {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  font-size: 18px;
}

.conversation-wrap {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.conversation {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.conversation-header,
.composer {
  padding: 18px 22px;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgba(153, 175, 199, 0.1);
}

.conversation-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.header-actions {
  display: inline-flex;
  gap: 8px;
}

.header-actions button {
  width: 38px;
  height: 38px;
}

.message-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 22px 12px;
  background:
    linear-gradient(180deg, rgba(9, 18, 29, 0.78), rgba(10, 18, 30, 0.44)),
    radial-gradient(circle at top, rgba(72, 163, 255, 0.12), transparent 40%);
}

.message-pane.loading {
  opacity: 0.7;
}

.day-divider {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

.day-divider span {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #8ea3b8;
  font-size: 12px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin: 10px 0;
}

.message-row.own {
  justify-content: flex-end;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 14px;
  flex: 0 0 auto;
}

.bubble {
  max-width: min(78%, 560px);
  padding: 12px 14px;
  border-radius: 20px 20px 20px 8px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.message-row.own .bubble {
  border-radius: 20px 20px 8px 20px;
  background: linear-gradient(135deg, rgba(92, 184, 255, 0.92), rgba(114, 230, 200, 0.88));
  color: #04111b;
}

.bubble strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.bubble p {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}

.bubble-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: rgba(228, 239, 247, 0.72);
}

.message-row.own .bubble-meta {
  color: rgba(4, 17, 27, 0.72);
  justify-content: flex-end;
  width: 100%;
}

.attachment-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.attachment-card.image {
  grid-template-columns: 96px minmax(0, 1fr);
}

.attachment-card img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 12px;
}

.attachment-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.12);
}

.attachment-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.attachment-copy span {
  color: inherit;
  opacity: 0.7;
  font-size: 12px;
}

.attachment-copy strong {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px 52px;
  gap: 12px;
  border-top: 1px solid rgba(153, 175, 199, 0.1);
}

.composer-main {
  min-height: 52px;
  padding: 8px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
}

.composer textarea {
  resize: none;
  min-height: 32px;
  max-height: 120px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  color: #a6bdd3;
}

.selected-file span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-file button {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: inherit;
}

.tool-button {
  width: 48px;
  height: 52px;
  align-self: end;
}

.send-button {
  width: 52px;
  height: 52px;
  align-self: end;
}

.send-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.details-top {
  padding: 8px 4px 0;
}

.details-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.details-tab-button {
  min-height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #9eb3c7;
}

.details-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 16px;
  padding-right: 2px;
}

.group-panel {
  display: grid;
  gap: 10px;
}

.announcement-input,
.modal-input {
  width: 100%;
  border: 0;
  outline: none;
  color: #edf6ff;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
}

.announcement-input {
  min-height: 84px;
  resize: vertical;
}

.group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.compact-cta {
  min-height: 38px;
  padding: 0 12px;
}

.danger-cta {
  background: rgba(255, 94, 94, 0.16);
}

.invite-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.invite-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #d6e5f3;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: #9db2c7;
}

.stat-card strong {
  font-size: 20px;
  color: #edf6ff;
}

.stat-card span {
  font-size: 12px;
}

.section-title {
  margin-bottom: 10px;
  color: #8da3b8;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.member-list {
  display: grid;
  align-content: start;
}

.settings-member-list {
  gap: 2px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.member-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-copy span {
  color: #8ea3b8;
  font-size: 12px;
}

.member-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.mini-action {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #dbe8f6;
}

.danger-text {
  color: #ffb0aa;
}

.file-browser {
  display: grid;
  gap: 8px;
}

.file-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.file-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-copy strong,
.file-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-copy span {
  color: #8ea3b8;
  font-size: 12px;
}

.empty-mini {
  margin: 0;
  color: #8ea3b8;
  font-size: 13px;
}

.group-modal {
  width: min(520px, 100%);
  padding: 22px;
  display: grid;
  gap: 12px;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #dce9f7;
}

.picker-row small {
  color: #86a0b8;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 48px 28px;
  text-align: center;
  min-height: 100%;
}

.empty-state h2 {
  margin: 0;
  font-size: 28px;
}

.media-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  gap: 14px;
  padding: 40px;
  background: rgba(3, 7, 14, 0.85);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 42px;
  height: 42px;
}

@media (max-width: 1180px) {
  .workspace {
    grid-template-columns: 300px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(260px, 34vh);
  }

  .details {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .app-shell {
    padding: 52px 12px 12px;
  }

  body {
    overflow: auto;
  }

  .workspace {
    grid-template-columns: 1fr;
    height: auto;
  }

  .sidebar {
    max-height: 42vh;
  }

  .conversation-wrap {
    min-height: 48vh;
  }

  .composer {
    grid-template-columns: minmax(0, 1fr) 44px 48px;
  }
}
</style>
