import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMaintenanceTickets,
  useCreateMaintenanceTicket,
  useUploadFile,
  getGetMaintenanceTicketsQueryKey
} from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Wrench, Plus, AlertTriangle, Camera, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  "Reported": { color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle },
  "In Progress": { color: "bg-blue-100 text-blue-800 border-blue-200", icon: Wrench },
  "Fixed": { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
};

export default function Maintenance() {
  const { userName } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"Urgent" | "General">("General");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useGetMaintenanceTickets();
  
  const uploadMutation = useUploadFile();
  const createTicket = useCreateMaintenanceTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMaintenanceTicketsQueryKey() });
        toast({ title: "Issue reported successfully" });
        setIsModalOpen(false);
        resetForm();
      }
    }
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("General");
    setFile(null);
    setPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    let photoUrl = null;

    if (file) {
      try {
        const res = await uploadMutation.mutateAsync({ data: { file } });
        photoUrl = res.url;
      } catch (err) {
        toast({ variant: "destructive", title: "Upload failed", description: "Could not upload image. Submitting without it." });
      }
    }

    createTicket.mutate({
      data: {
        title,
        description,
        category,
        photoUrl,
        reportedBy: userName
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" />
            The Fix-It Hub
          </h1>
          <p className="text-muted-foreground mt-1">Report facility issues and track repairs.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl shadow-lg shadow-primary/20 h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Report Issue
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-muted rounded-2xl"></div>)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-border">
          <CheckCircle2 className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground">All clear!</h3>
          <p className="text-muted-foreground mt-2">No maintenance issues reported.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((ticket) => {
            const StatusIcon = STATUS_CONFIG[ticket.status].icon;
            return (
              <Card key={ticket.id} className="overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all border-border/50 bg-white/80 backdrop-blur-sm flex flex-col sm:flex-row">
                {ticket.photoUrl && (
                  <div className="w-full sm:w-48 h-48 sm:h-auto bg-slate-100 flex-shrink-0">
                    <img src={ticket.photoUrl} alt="Issue" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
                        STATUS_CONFIG[ticket.status].color
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {ticket.status}
                      </span>
                      {ticket.category === "Urgent" && (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-500 text-white uppercase tracking-wider">
                          Urgent
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 leading-tight">{ticket.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border/40 text-xs text-slate-500 flex justify-between items-center">
                    <span>Reported by <span className="font-medium text-slate-700">{ticket.reportedBy}</span></span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-slate-50/50">
            <DialogTitle className="text-2xl font-display">Report an Issue</DialogTitle>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Issue Title</label>
              <Input 
                placeholder="e.g. Leaking sink in 2nd floor pantry" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                placeholder="Please provide details to help maintenance find and fix the issue..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none min-h-[100px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority Level</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setCategory("General")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-sm font-medium",
                    category === "General" ? "border-slate-800 bg-slate-50" : "border-transparent bg-slate-100 hover:bg-slate-200 text-slate-600"
                  )}
                >
                  General (Squeaky chair, bulb)
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("Urgent")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-sm font-medium",
                    category === "Urgent" ? "border-red-500 bg-red-50 text-red-700" : "border-transparent bg-slate-100 hover:bg-slate-200 text-slate-600"
                  )}
                >
                  Urgent (Leak, Safety hazard)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                Photo (Optional)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              {preview ? (
                <div className="relative rounded-xl overflow-hidden h-40 border border-border group">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Change Photo</Button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center text-muted-foreground"
                >
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm">Tap to snap or upload</span>
                </button>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-border bg-slate-50/50 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-12 rounded-xl">Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!title.trim() || !description.trim() || createTicket.isPending || uploadMutation.isPending}
              className="h-12 rounded-xl px-8 shadow-lg"
            >
              {createTicket.isPending || uploadMutation.isPending ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
