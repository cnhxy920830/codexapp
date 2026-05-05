import { invoke } from "@tauri-apps/api/core";

export type ThreadHistoryEntry = {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  name: string | null;
};

export type HistoryThreadView = {
  id: string;
  title: string;
  age: string;
  active?: boolean;
};

export type HistoryProjectGroup = {
  name: string;
  threads: HistoryThreadView[];
};

export type ThreadConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type ThreadConversation = {
  id: string;
  title: string;
  cwd: string;
  messages: ThreadConversationMessage[];
};

export async function getRecentThreads() {
  return invoke<ThreadHistoryEntry[]>("list_recent_threads");
}

export async function readThread(threadId: string) {
  return invoke<ThreadConversation>("read_thread", { threadId });
}

export function buildProjectGroups(
  entries: ThreadHistoryEntry[],
  options?: { activeThreadId?: string | null; locale?: string; now?: Date; noMessageLabel?: string },
) {
  const now = options?.now ?? new Date();
  const activeThreadId = options?.activeThreadId ?? null;
  const locale = options?.locale ?? "en-US";
  const noMessageLabel = options?.noMessageLabel ?? "(no message yet)";
  const groups = new Map<string, HistoryProjectGroup>();

  for (const entry of entries) {
    const groupName = deriveProjectName(entry.cwd);
    const current = groups.get(groupName) ?? { name: groupName, threads: [] };
    current.threads.push({
      id: entry.id,
      title: (entry.name ?? entry.preview).trim() || noMessageLabel,
      age: formatRelativeTime(entry.updatedAt, now, locale),
      active: activeThreadId === entry.id,
    });
    groups.set(groupName, current);
  }

  return Array.from(groups.values());
}

function deriveProjectName(cwd: string) {
  const segments = cwd.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? cwd;
}

function formatRelativeTime(unixSeconds: number, now: Date, locale: string) {
  const diffMs = now.getTime() - unixSeconds * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMs < minute) {
    return formatter.format(0, "minute");
  }
  if (diffMs < hour) {
    return formatter.format(-Math.floor(diffMs / minute), "minute");
  }
  if (diffMs < day) {
    return formatter.format(-Math.floor(diffMs / hour), "hour");
  }
  return formatter.format(-Math.floor(diffMs / day), "day");
}
