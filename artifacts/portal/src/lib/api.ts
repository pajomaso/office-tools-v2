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
export type TagStatus = "active" | "spare" | "lost" | "blocked" | "pending";
export type TagLevel = "user" | "administrator" | "service";
export type ChangeKind = "assign" | "reassign" | "rename" | "lost" | "return";
export type TagRow = {
  id: string; number: string; status: TagStatus; baseStatus: Exclude<TagStatus, "pending">; holderName: string; clientId: string | null; user: string | null;
  level: TagLevel; note: string; companyId: string | null; company: string | null; hasCode: boolean;
  pending: { changeId: string; kind: ChangeKind; toName: string; batchStatus: string } | null;
};
export type TagLine = {
  id: string; tagId: string; tagNumber: string; kind: ChangeKind; fromName: string; toName: string; status: "pending" | "done" | "outdated" | "removed";
  note: string; doneAt: string | null; doneBy: string | null;
};
export type TagBatch = { id: string; status: "open" | "sent" | "done"; createdAt: string; sentAt: string | null; expiresAt: string | null; linkActive: boolean; revoked: boolean; lines: TagLine[] };
export type AdminTags = { tags: TagRow[]; open: TagBatch | null; sent: TagBatch[]; supplier: { name?: string; email?: string } };
export type TagLogRow = { id: string; tagNumber: string; event: string; detail: string; actor: string; bySupplier: boolean; ip: string | null; createdAt: string };
export type TagNotifications = { unread: number; items: { id: string; tagNumber: string; event: string; detail: string; actor: string; createdAt: string }[] };
export type MyTag = { tag: { status: string; level: string; hasCode: boolean } | null; pending: { kind: ChangeKind; hasCode: boolean } | null };
export type SupplierLine = { id: string; tagNumber: string; kind: ChangeKind; fromName: string; toName: string; level: TagLevel; status: TagLine["status"]; doneAt: string | null };
export type AdminUser = {
  id: string; email: string; name: string; role: "user" | "admin"; kind: "company" | "event"; companyId: string | null; company: string | null;
  hasPassword: boolean; tag: string | null; pendingTag: string | null; hasOpenRequest: boolean;
};
export type Company = { id: string; name: string };
export type MailPreview = { sent: boolean; preview: { to: string; subject: string; body: string }; devLink?: string };
export type InboxCount = { pending: number; items: number; openTagLines: number; supplierUpdates: number };

