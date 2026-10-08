export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api/portal${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init?.json ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong");
  return data as T;
}

export type Me = { id: string; name: string; email: string; role: "user" | "admin"; kind: "company" | "event"; company: string | null; hasPassword: boolean };
export type Room = { id: string; name: string; seats: number; color: string; photoVersion: number | null };
export type Booking = {
  id: string; roomId: string; startsAt: string; endsAt: string; mine: boolean; canEdit: boolean;
  title?: string; bookedFor?: string | null; notes?: string; owner?: string;
};
export type Block = { id: string; roomId: string | null; kind: "cleaning" | "maintenance"; title: string; startsAt: string; endsAt: string };
export type MyBookings = { upcoming: Booking[]; past: Booking[] };
export type Message = {
  id: string; body: string; pinned: boolean; author: string; createdAt: string; editedAt: string | null; expiresAt: string;
  mine: boolean; canEdit: boolean; canDelete: boolean; canPin: boolean;
};
export type Messages = { current: Message[]; past: Message[] };
export type Item = {
  id: string; kind: "issue" | "request"; title: string; body: string; visibility: "public" | "private"; status: "open" | "claimed" | "done";
  statusNote: string; claimedBy: string | null; claimedByName: string | null; author: string; authorId: string; mine: boolean;
  following: boolean; followers: number; createdAt: string; updatedAt: string;
};
export type Area = {
  wifi: { label: string; internal: boolean; ssid: string; password: string; note: string }[];
  guides: { id: string; title: string; body: string }[];
  bookingNote: string;
};
export type Tag = { id: string; number: string; clientId?: string | null; client?: string | null; access: string; status: "active" | "spare" | "lost" | "blocked" | "pending"; hasCode?: boolean };
export type TagRequest = {
  id: string; clientId: string; kind: "new" | "replace" | "deactivate"; note: string; status: "to_send" | "sent" | "confirmed" | "rejected";
  newTagNumber: string | null; createdAt: string; client?: string; clientEmail?: string; oldNumber?: string | null;
};
export type MyTag = { tag: Tag | null; requests: TagRequest[] };
export type AdminTags = { tags: Tag[]; requests: TagRequest[]; supplier: { name?: string; email?: string } };
export type AdminUser = {
  id: string; email: string; name: string; role: "user" | "admin"; kind: "company" | "event"; companyId: string | null; company: string | null;
  hasPassword: boolean; tag: string | null; pendingTag: string | null; hasOpenRequest: boolean;
};
export type Company = { id: string; name: string };
export type MailPreview = { sent: boolean; preview: { to: string; subject: string; body: string }; devLink?: string };
export type Todo = { tagRequests: TagRequest[] };

