import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetScheduledMaintenance, useCreateScheduledMaintenance, useUpdateScheduledMaintenance, useDeleteScheduledMaintenance,
  getGetScheduledMaintenanceQueryKey
} from "@workspace/api-client-react";
import { Plus, Trash2, Check, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

export default function AdminScheduled() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tasks = [] } = useGetScheduledMaintenance();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ taskName: "", description: "", frequencyDays: 30, nextDue: format(new Date(), 'yyyy-MM-dd') });

  const createT = useCreateScheduledMaintenance({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetScheduledMaintenanceQueryKey() }); setIsModalOpen(false); toast({title:"Task saved"}); } }
  });
  const updateT = useUpdateScheduledMaintenance({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetScheduledMaintenanceQueryKey() }); toast({title:"Task marked done"}); } }
  });
  const deleteT = useDeleteScheduledMaintenance({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetScheduledMaintenanceQueryKey() }); toast({title:"Task deleted"}); } }
  });

  const markDone = (t: any) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const next = format(addDays(new Date(), t.frequencyDays), 'yyyy-MM-dd');
    updateT.mutate({
      id: t.id,
      data: { ...t, lastDone: today, nextDue: next }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold font-display">Scheduled Maintenance Log</h1>
        <Button onClick={() => { setForm({ taskName: "", description: "", frequencyDays: 30, nextDue: format(new Date(), 'yyyy-MM-dd') }); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2"/> Add Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map(t => {
          const isOverdue = new Date(t.nextDue) < new Date();
          return (
            <Card key={t.id} className={`p-5 flex flex-col bg-white border-l-4 ${isOverdue ? 'border-l-red-500' : 'border-l-primary'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {isOverdue && <AlertCircle className="w-4 h-4 text-red-500"/>}
                    {t.taskName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteT.mutate({id: t.id})}><Trash2 className="w-4 h-4 text-red-400"/></Button>
              </div>
              
              <div className="mt-4 pt-4 border-t flex justify-between items-end">
                <div className="text-sm">
                  <div className="text-slate-500 mb-1">Every {t.frequencyDays} days</div>
                  <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'} flex items-center gap-1.5`}>
                    <Calendar className="w-4 h-4"/> Due: {new Date(t.nextDue).toLocaleDateString()}
                  </div>
                  {t.lastDone && <div className="text-xs text-slate-400 mt-1">Last done: {new Date(t.lastDone).toLocaleDateString()}</div>}
                </div>
                <Button size="sm" variant={isOverdue ? "default" : "outline"} onClick={() => markDone(t)} disabled={updateT.isPending}>
                  <Check className="w-4 h-4 mr-1"/> Mark Done
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Scheduled Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Task Name (e.g. AC Filter Cleaning)" value={form.taskName} onChange={e=>setForm({...form, taskName: e.target.value})} />
            <Input placeholder="Description" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Frequency (Days)</label>
                <Input type="number" value={form.frequencyDays} onChange={e=>setForm({...form, frequencyDays: parseInt(e.target.value) || 30})} />
              </div>
              <div>
                <label className="text-xs font-medium">Next Due Date</label>
                <Input type="date" value={form.nextDue} onChange={e=>setForm({...form, nextDue: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createT.mutate({data: form})} disabled={!form.taskName}>Save Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
