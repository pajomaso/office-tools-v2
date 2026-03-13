import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetVendors, useCreateVendor, useUpdateVendor, useDeleteVendor,
  getGetVendorsQueryKey
} from "@workspace/api-client-react";
import { Phone, Mail, FileText, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const SPECIALTIES = ["Plumber", "Electrician", "IT", "HVAC", "Cleaning", "General"] as const;

export default function AdminVendors() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: vendors = [] } = useGetVendors();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [form, setForm] = useState<any>({ name: "", specialty: "General", phone: "", email: "", notes: "" });

  const createVendor = useCreateVendor({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetVendorsQueryKey() }); setIsModalOpen(false); toast({title:"Vendor saved"}); } }
  });
  const updateVendor = useUpdateVendor({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetVendorsQueryKey() }); setIsModalOpen(false); toast({title:"Vendor saved"}); } }
  });
  const deleteVendor = useDeleteVendor({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetVendorsQueryKey() }); toast({title:"Vendor deleted"}); } }
  });

  const openNew = () => { setForm({ name: "", specialty: "General", phone: "", email: "", notes: "" }); setEditingId(null); setIsModalOpen(true); };
  const openEdit = (v: any) => { setForm({...v}); setEditingId(v.id); setIsModalOpen(true); };

  const handleSave = () => {
    if (editingId) updateVendor.mutate({ id: editingId, data: form });
    else createVendor.mutate({ data: form });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold font-display">Private Vendor Directory</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2"/> Add Vendor</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map(v => (
          <Card key={v.id} className="p-5 flex flex-col bg-white border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{v.name}</h3>
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{v.specialty}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}><Edit className="w-4 h-4 text-slate-500"/></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteVendor.mutate({id: v.id})}><Trash2 className="w-4 h-4 text-red-400"/></Button>
              </div>
            </div>
            
            <div className="space-y-2 mt-4 flex-1">
              <div className="flex items-center text-sm text-slate-600 gap-2"><Phone className="w-4 h-4"/> {v.phone}</div>
              {v.email && <div className="flex items-center text-sm text-slate-600 gap-2"><Mail className="w-4 h-4"/> {v.email}</div>}
              {v.notes && <div className="flex items-start text-sm text-slate-500 gap-2 mt-2 pt-2 border-t"><FileText className="w-4 h-4 mt-0.5 shrink-0"/> <p>{v.notes}</p></div>}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit" : "New"} Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Company / Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <select className="w-full h-10 px-3 rounded-md border" value={form.specialty} onChange={e=>setForm({...form, specialty: e.target.value})}>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input placeholder="Phone Number" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            <Input placeholder="Email (Optional)" value={form.email || ""} onChange={e=>setForm({...form, email: e.target.value})} />
            <Input placeholder="Private Notes (Optional)" value={form.notes || ""} onChange={e=>setForm({...form, notes: e.target.value})} />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.name || !form.phone}>Save Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
