import type { Room } from "@/lib/api";

// A room's photo, or its colour when no photo has been uploaded yet.
export default function RoomPhoto({ room, className }: { room: Room; className?: string }) {
  return room.photoVersion ? (
    <img src={`/api/portal/rooms/${room.id}/photo?v=${room.photoVersion}`} alt={`${room.name}`} loading="lazy" className={`object-cover ${className ?? ""}`} />
  ) : (
    <div aria-hidden="true" className={className} style={{ backgroundColor: `color-mix(in oklch, ${room.color} 14%, var(--surface))` }} />
  );
}
