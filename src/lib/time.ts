export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSidebarTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return formatMessageTime(iso);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatLastSeen(iso: string): string {
  const diffMinutes = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );

  if (diffMinutes < 2) {
    return "last seen just now";
  }

  if (diffMinutes < 60) {
    return `last seen ${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `last seen ${diffHours}h ago`;
  }

  return `last seen ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso))}`;
}
