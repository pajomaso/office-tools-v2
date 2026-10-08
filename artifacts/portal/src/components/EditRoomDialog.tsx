import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Room } from "@/lib/api";
import { Button, Dialog, fieldInput, fieldLabel } from "@/components/ui";
import RoomPhoto from "@/components/RoomPhoto";

// Admin: edit a room (name, seats, photo). Used from the Rooms page and from Settings.
export default function EditRoomDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(room.name), [seats, setSeats] = useState(String(room.seats));
  const done = () => qc.invalidateQueries({ queryKey: ["rooms"] });
  const save = useMutation({ mutationFn: () => api(`/admin/rooms/${room.id}`, { method: "PATCH", json: { name, seats: Number(seats) } }), onSuccess: () => { done(); onClose(); } });
  const photo = useMutation({ mutationFn: (f: File) => { const b = new FormData(); b.set("file", f); return api(`/admin/rooms/${room.id}/photo`, { method: "PUT", body: b }); }, onSuccess: done });
  const drop = useMutation({ mutationFn: () => api(`/admin/rooms/${room.id}/photo`, { method: "DELETE" }), onSuccess: done });
  const live = qc.getQueryData<Room[]>(["rooms"])?.find((r) => r.id === room.id) ?? room;
  const err = save.error ?? photo.error ?? drop.error;
  return (
    <Dialog title={`Edit ${room.name}`} description="Everyone sees the name and the photo." onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <RoomPhoto room={live} className="aspect-[16/9] w-full rounded-md" />
        <div className="flex items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--line-strong)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]">
            {photo.isPending ? "Uploading…" : live.photoVersion ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) photo.mutate(f); e.target.value = ""; }} />
          </label>
          {live.photoVersion && <Button type="button" variant="outline" disabled={drop.isPending} onClick={() => drop.mutate()}>Remove</Button>}
          <span className="text-xs text-[var(--ink-mute)]">JPEG, PNG or WebP, up to 2 MB</span>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <div><label className={fieldLabel} htmlFor="er-name">Name</label><input id="er-name" required maxLength={60} className={fieldInput} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className={fieldLabel} htmlFor="er-seats">Seats</label><input id="er-seats" required type="number" min={1} max={50} className={fieldInput} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
        </div>
        {err && <p role="alert" className="text-sm text-[var(--danger)]">{err.message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button><Button type="submit" disabled={save.isPending}>Save</Button></div>
      </form>
    </Dialog>
  );
}

