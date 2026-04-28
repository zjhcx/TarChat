import { type ChatMessage, type ChatSummary, type ChatUser } from "./chatApi";

export type TimelineEntry =
  | { kind: "divider"; id: string; label: string }
  | { kind: "message"; id: string; message: ChatMessage; sender?: ChatUser; own: boolean };

export function buildTimeline(
  messages: ChatMessage[],
  usersById: Record<string, ChatUser>,
  selfUserId?: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let lastLabel = "";

  for (const message of messages) {
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(message.createdAt));
    if (label !== lastLabel) {
      entries.push({ kind: "divider", id: `divider-${label}`, label });
      lastLabel = label;
    }
    entries.push({
      kind: "message",
      id: message.id,
      message,
      sender: usersById[message.senderId],
      own: message.senderId === selfUserId,
    });
  }

  return entries;
}

export function avatarLabel(chat: ChatSummary) {
  if (chat.kind === "saved") {
    return "SM";
  }
  return chat.title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function previewLine(chat: ChatSummary) {
  if (chat.lastMessage?.attachment) {
    return chat.lastMessage.attachment.kind === "image"
      ? `[Image] ${chat.lastMessage.attachment.name}`
      : `[File] ${chat.lastMessage.attachment.name}`;
  }
  return chat.lastMessage?.text || chat.description;
}

export function messageStateIcon(message: ChatMessage) {
  return message.delivery === "read" ? "check-double" : "check";
}

export function attachmentLabel(message: ChatMessage) {
  if (!message.attachment) {
    return "";
  }
  return message.attachment.kind === "image" ? "Image" : "File";
}
