import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetInventoryRequests,
  useUpdateInventoryRequest,
  useDeleteInventoryRequest,
  getGetInventoryRequestsQueryKey
} from "@workspace/api-client-react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminInventory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: requests = [] } = useGetInventoryRequests();

  const updateReq = useUpdateInventoryRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryRequestsQueryKey() });
        toast({ title: "Status updated" });
      }
    }
  });

  const deleteReq = useDeleteInventoryRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryRequestsQueryKey() });
        toast({ title: "Request deleted" });
      }
    }
  });

  const handleStatusChange = (id: number, status: any) => {
    updateReq.mutate({ id, data: { status } });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold font-display">Master Shopping List</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-500">Item</th>
              <th className="px-4 py-3 font-medium text-slate-500">Requested By</th>
              <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
              <th className="px-4 py-3 font-medium text-slate-500">Upvotes</th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 font-medium text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...requests].sort((a,b) => b.upvotes - a.upvotes).map((req) => (
              <tr key={req.id} className="border-b border-border/50 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium">{req.itemName}</td>
                <td className="px-4 py-3 text-muted-foreground">{req.requestedBy}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs",
                    req.urgency === 'High' ? "bg-red-100 text-red-700" : 
                    req.urgency === 'Medium' ? "bg-amber-100 text-amber-700" : "bg-slate-100"
                  )}>{req.urgency}</span>
                </td>
                <td className="px-4 py-3 font-bold">{req.upvotes}</td>
                <td className="px-4 py-3">
                  <select 
                    className={cn(
                      "text-xs p-1.5 rounded border-0 font-medium cursor-pointer outline-none ring-2 ring-transparent focus:ring-primary/50 transition-colors",
                      req.status === 'Pending' ? "bg-amber-100 text-amber-800" :
                      req.status === 'Ordered' ? "bg-blue-100 text-blue-800" :
                      req.status === 'Stocked' ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    )}
                    value={req.status}
                    onChange={(e) => handleStatusChange(req.id, e.target.value)}
                    disabled={updateReq.isPending}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Stocked">Stocked</option>
                    <option value="Denied">Denied</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => deleteReq.mutate({ id: req.id })}>
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
