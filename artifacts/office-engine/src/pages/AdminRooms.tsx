import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetRooms,
  useCreateRoom,
  useUpdateRoom,
  getGetRoomsQueryKey
} from "@workspace/api-client-react";
import { Edit, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AdminRooms() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rooms = [], isLoading } = useGetRooms();
  
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
        <Button onClick={() => {
          setIsCreating(true);
          setEditingId(null);
          setEditForm({ name: "", capacity: 10, description: "", photoUrl: "" });
        }}>
          <Plus className="w-4 h-4 mr-2" /> Add Room
        </Button>
      </div>

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
