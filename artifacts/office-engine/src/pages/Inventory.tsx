import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetInventoryRequests,
  useCreateInventoryRequest,
  useUpvoteInventoryRequest,
  getGetInventoryRequestsQueryKey
} from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Coffee, Plus, ThumbsUp, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const URGENCY_COLORS = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-red-100 text-red-700"
};

const STATUS_COLORS = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Ordered: "border-blue-200 bg-blue-50 text-blue-700",
  Stocked: "border-green-200 bg-green-50 text-green-700",
  Denied: "border-red-200 bg-red-50 text-red-700",
};

export default function Inventory() {
  const { userName } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Track local upvotes
  const [upvotedItems, setUpvotedItems] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('upvotes') || '[]'));
    } catch { return new Set(); }
  });

  const { data: requests = [], isLoading } = useGetInventoryRequests();

  const createReq = useCreateInventoryRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryRequestsQueryKey() });
        toast({ title: "Request added to wishlist!" });
        setIsModalOpen(false);
      }
    }
  });

  const upvoteReq = useUpvoteInventoryRequest({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryRequestsQueryKey() });
        const newSet = new Set(upvotedItems).add(variables.id);
        setUpvotedItems(newSet);
        localStorage.setItem('upvotes', JSON.stringify(Array.from(newSet)));
      }
    }
  });

  // Form State
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<"Food" | "Office Supply">("Food");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High">("Medium");

  const handleSubmit = () => {
    if (!itemName.trim()) return;
    createReq.mutate({
      data: {
        itemName,
        category,
        urgency,
        requestedBy: userName
      }
    });
  };

  const handleUpvote = (id: number) => {
    if (upvotedItems.has(id)) return;
    upvoteReq.mutate({ id });
  };

  // Sort: Pending first, then by upvotes
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
    return b.upvotes - a.upvotes;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <PackageOpen className="w-8 h-8 text-primary" />
            Pantry & Supplies
          </h1>
          <p className="text-muted-foreground mt-1">Request snacks, drinks, and office supplies.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl shadow-lg shadow-primary/20 h-12 px-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Make Request
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-muted rounded-2xl"></div>)}
        </div>
      ) : sortedRequests.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-border">
          <Coffee className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground">Wishlist is empty</h3>
          <p className="text-muted-foreground mt-2">Be the first to request something!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRequests.map((req) => (
            <Card key={req.id} className="p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border-border/50 flex flex-col justify-between bg-white/80 backdrop-blur-sm">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", STATUS_COLORS[req.status])}>
                    {req.status}
                  </span>
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", URGENCY_COLORS[req.urgency])}>
                    {req.urgency} Priority
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{req.itemName}</h3>
                <p className="text-sm text-muted-foreground">
                  {req.category} • Requested by <span className="font-medium">{req.requestedBy}</span>
                </p>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={cn(
                    "rounded-xl gap-2 transition-all",
                    upvotedItems.has(req.id) ? "bg-primary/10 text-primary border-primary/20" : "hover:bg-muted"
                  )}
                  onClick={() => handleUpvote(req.id)}
                  disabled={upvotedItems.has(req.id) || req.status !== 'Pending'}
                >
                  <ThumbsUp className={cn("w-4 h-4", upvotedItems.has(req.id) && "fill-current")} />
                  {req.upvotes}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">New Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Name</label>
              <Input 
                placeholder="e.g. Oat Milk, Whiteboard Markers" 
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select 
                  className="w-full h-12 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                >
                  <option value="Food">Food / Beverage</option>
                  <option value="Office Supply">Office Supply</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency</label>
                <select 
                  className="w-full h-12 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  value={urgency}
                  onChange={e => setUrgency(e.target.value as any)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-12 rounded-xl">Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!itemName.trim() || createReq.isPending}
              className="h-12 rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              {createReq.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
