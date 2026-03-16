import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteBooking,
  getGetRoomsQueryKey,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { Edit, Plus, Save, X, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminRooms() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rooms = [], isLoading } = useGetRooms();

  const [pastBookings, setPastBookings] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/bookings?past=true");
      const data = await res.json();
      setPastBookings(data.sort((a: any, b: any) => b.date.localeCompare(a.date)));
    } catch { toast({ variant: "destructive", title: "Failed to load history" }); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  const deleteBooking = useDeleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
        fetchHistory();
        toast({ title: "Booking removed" });
      },
    },
  });
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const [isCreating, setIsCreating] = useState(false);

  const updateRoom = useUpdateRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRoomsQueryKey() });
        toast({ title: "Room updated successfully" });
        setEditingId(null);
      }
    }
  });

  const createRoom = useCreateRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRoomsQueryKey() });
        toast({ title: "Room created" });
        setIsCreating(false);
      }
    }
  });

  const startEdit = (room: any) => {
    setEditingId(room.id);
    setEditForm({ ...room });
  };

  const handleSave = () => {
    if (isCreating) {
      createRoom.mutate({
        data: {
          name: editForm.name,
          capacity: parseInt(editForm.capacity) || 10,
          description: editForm.description,
          photoUrl: editForm.photoUrl
        }
      });
    } else if (editingId) {
      updateRoom.mutate({
        id: editingId,
        data: {
          name: editForm.name,
          capacity: parseInt(editForm.capacity) || 10,
          description: editForm.description,
          photoUrl: editForm.photoUrl
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold font-display">Manage Rooms</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowHistory(v => !v)}>
            <History className="w-4 h-4 mr-2" /> {showHistory ? "Hide History" : "Booking History"}
          </Button>
          <Button onClick={() => {
          setIsCreating(true);
          setEditingId(null);
          setEditForm({ name: "", capacity: 10, description: "", photoUrl: "" });
          }}>
            <Plus className="w-4 h-4 mr-2" /> Add Room
          </Button>
        </div>
      </div>

      {showHistory && (
        <Card className="p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Past Bookings</h2>
          </div>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
          ) : pastBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past bookings found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pastBookings.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">{b.date}</div>
                    <div className="text-sm font-medium truncate">{b.roomName}</div>
                    <div className="text-sm text-muted-foreground truncate">{b.userName}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {b.startTime}–{b.endTime}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteBooking.mutate({ id: b.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="space-y-4">
        {isCreating && (
          <Card className="p-4 border-primary ring-2 ring-primary/20">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Capacity</label>
                <Input type="number" value={editForm.capacity} onChange={e => setEditForm({...editForm, capacity: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Photo URL (Optional)</label>
                <Input value={editForm.photoUrl} onChange={e => setEditForm({...editForm, photoUrl: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createRoom.isPending}>Save</Button>
            </div>
          </Card>
        )}

        {rooms.map(room => (
          <Card key={room.id} className="p-4 flex flex-col md:flex-row gap-4 items-center bg-white/50 backdrop-blur-sm">
            {room.photoUrl ? (
              <img src={room.photoUrl} alt="Room" className="w-24 h-24 rounded-lg object-cover bg-muted" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">No Image</div>
            )}
            
            {editingId === room.id ? (
              <div className="flex-1 w-full space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  <Input placeholder="Capacity" type="number" value={editForm.capacity} onChange={e => setEditForm({...editForm, capacity: e.target.value})} />
                  <Input className="col-span-2" placeholder="Description" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                  <Input className="col-span-2" placeholder="Photo URL" value={editForm.photoUrl || ""} onChange={e => setEditForm({...editForm, photoUrl: e.target.value})} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1"/> Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={updateRoom.isPending}><Save className="w-4 h-4 mr-1"/> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{room.name}</h3>
                  <p className="text-sm text-muted-foreground">{room.description} • Capacity: {room.capacity}</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => startEdit(room)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
