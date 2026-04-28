export interface ChatUser {
  id: string;
  name: string;
  handle: string;
  avatarText: string;
  accentColor: string;
  role: string;
  status: string;
  about: string;
  lastSeenAt: string;
}

export interface ChatMember extends ChatUser {
  memberRole: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  kind: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  delivery: string;
  type: string;
  attachment?: Attachment;
}

export interface ChatSummary {
  id: string;
  title: string;
  kind: string;
  accentColor: string;
  ownerId: string;
  memberIds: string[];
  pinned: boolean;
  muted: boolean;
  locked: boolean;
  description: string;
  announcement: string;
  selfMemberRole: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastActivityAt: string;
  onlineMemberIds: string[];
}

export interface GroupFile {
  attachment: Attachment;
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface BootstrapPayload {
  self: ChatUser;
  users: Record<string, ChatUser>;
  chats: ChatSummary[];
}

export interface ChatDetailPayload {
  self: ChatUser;
  chat: ChatSummary;
  participants: ChatMember[];
  messages: ChatMessage[];
  files: GroupFile[];
}

export interface ChatEventPayload {
  chat: ChatSummary;
  message?: ChatMessage;
  userId?: string;
}

const SERVER_ORIGIN = "http://127.0.0.1:9090";
const AUTH_TOKEN_KEY = "tarchat.auth.token";

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) ?? "";

function authHeaders(init?: HeadersInit): HeadersInit {
  return {
    ...(init ?? {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_ORIGIN}${path}`, {
    ...init,
    headers: authHeaders(init?.headers),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getServerOrigin(): string {
  return SERVER_ORIGIN;
}

export function getAttachmentOpenUrl(attachmentId: string): string {
  return `${SERVER_ORIGIN}/api/attachments/${encodeURIComponent(attachmentId)}/open`;
}

export function getStoredToken(): string {
  return authToken;
}

export function setStoredToken(token: string) {
  authToken = token;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken() {
  authToken = "";
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function createSocketUrl(token: string) {
  const wsOrigin = SERVER_ORIGIN.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsOrigin}/api/ws?token=${encodeURIComponent(token)}`;
}

export function login(handle: string, password: string) {
  return request<{ token: string; user: ChatUser }>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ handle, password }),
  });
}

export function register(name: string, handle: string, password: string) {
  return request<{ token: string; user: ChatUser }>("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, handle, password }),
  });
}

export function logout() {
  return request<{ status: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function fetchBootstrap() {
  return request<BootstrapPayload>("/api/bootstrap");
}

export function fetchUsers() {
  return request<{ users: ChatUser[] }>("/api/users");
}

export function fetchChatDetail(chatId: string) {
  return request<ChatDetailPayload>(`/api/chats/${chatId}`);
}

export function createGroupChat(title: string, description: string, memberIds: string[]) {
  return request<ChatDetailPayload>("/api/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, description, memberIds }),
  });
}

export function markChatRead(chatId: string) {
  return request<ChatEventPayload>(`/api/chats/${chatId}/read`, {
    method: "POST",
  });
}

export function fetchChatFiles(chatId: string) {
  return request<{ files: GroupFile[] }>(`/api/chats/${chatId}/files`);
}

export function dissolveGroupChat(chatId: string) {
  return request<{ status: string; chatId: string }>(`/api/chats/${chatId}/dissolve`, {
    method: "POST",
  });
}

export function updateAnnouncement(chatId: string, announcement: string) {
  return request<ChatEventPayload>(`/api/chats/${chatId}/announcement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ announcement }),
  });
}

export function setChatLocked(chatId: string, locked: boolean) {
  return request<ChatEventPayload>(`/api/chats/${chatId}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locked }),
  });
}

export function transferOwnership(chatId: string, newOwnerId: string) {
  return request<ChatDetailPayload>(`/api/chats/${chatId}/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newOwnerId }),
  });
}

export function addChatMember(chatId: string, userId: string) {
  return request<ChatDetailPayload>(`/api/chats/${chatId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export function removeChatMember(chatId: string, userId: string) {
  return request<ChatDetailPayload>(`/api/chats/${chatId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function updateMemberRole(chatId: string, userId: string, role: string) {
  return request<ChatDetailPayload>(`/api/chats/${chatId}/members/${userId}/role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  });
}

export async function sendMessage(chatId: string, text: string, file?: File | null) {
  const body = new FormData();
  if (text.trim()) {
    body.append("text", text.trim());
  }
  if (file) {
    body.append("file", file);
  }

  const response = await fetch(`${SERVER_ORIGIN}/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return (await response.json()) as ChatEventPayload;
}
