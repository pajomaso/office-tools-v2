import type { ChangeKind } from "@/lib/api";

export const statusLabel = { active: "Active", spare: "Spare", lost: "Lost", blocked: "Blocked", pending: "Pending" } as const;
export const levelLabel = { user: "User", administrator: "Administrator", service: "Service" } as const;
export const kindLabel: Record<ChangeKind, string> = { assign: "Assign", reassign: "Reassign", rename: "Rename", lost: "Mark as lost", return: "Returned" };

// One line the way the supplier reads it: what the tag is now, and what to change it to.
export function lineText(l: { tagNumber: string; kind: ChangeKind; fromName: string; toName: string }): string {
  const n = `Tag ${l.tagNumber}`;
  switch (l.kind) {
    case "assign": return `${n}, currently spare → assign to ${l.toName}`;
    case "reassign": return `${n}, currently assigned to ${l.fromName || "nobody"} → change to ${l.toName}`;
    case "rename": return `${n}, currently named ${l.fromName || "(no name)"} → rename to ${l.toName}`;
    case "lost": return `${n}, currently assigned to ${l.fromName || "nobody"} → mark as lost`;
    case "return": return `${n}, returned by ${l.fromName || "its holder"} → back to spare`;
  }
}

export const eventLabel: Record<string, string> = {
  tag_recorded: "Tag recorded", tag_edited: "Tag edited", status_changed: "Status changed", code_changed: "Code changed", change_added: "Change added",
  change_removed: "Change removed", batch_sent: "Batch sent", link_regenerated: "New link made", link_revoked: "Link revoked",
  line_done: "Done", line_outdated: "Out of date", line_reopened: "Reopened",
};
