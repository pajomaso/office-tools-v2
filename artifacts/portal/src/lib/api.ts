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
export type Room = { id: string; name: string; seats: number; color: string };
export type Booking = {
  id: string; roomId: string; startsAt: string; endsAt: string; mine: boolean;
  title?: string; attendees?: number; notes?: string;
};
export type Summary = { upcoming: Booking[]; updatedReports: number };
export type MyBookings = { upcoming: Booking[]; past: Booking[] };
export type Office = {
  wifi: { label: string; visibility: string; ssid: string; password: string; note: string }[];
  videos: { title: string; duration: string; description: string; url: string }[];
  info: { office?: string; city?: string; address?: string; managerContact?: string; rules?: string[] };
};
export type Report = {
  id: string; kind: "issue" | "supply"; title: string; details: string; status: "open" | "in_progress" | "done";
  managerNote: string; createdAt: string; updatedAt: string; updated?: boolean; reporter?: string; reporterEmail?: string;
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

export type Announcement = { id: string; title: string; body: string; pinned: boolean; createdAt: string; author: string };
export type Post = { id: string; body: string; createdAt: string; author: string; mine: boolean; canDelete: boolean };
