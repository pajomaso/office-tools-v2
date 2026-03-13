import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMaintenanceTickets,
  useUpdateMaintenanceTicket,
  getGetMaintenanceTicketsQueryKey
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tickets = [] } = useGetMaintenanceTickets();

  const updateTicket = useUpdateMaintenanceTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMaintenanceTicketsQueryKey() });
        toast({ title: "Ticket status updated" });
      }
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold font-display">Manage Maintenance Tickets</h1>
      
      <div className="grid grid-cols-1 gap-4">
        {tickets.map(ticket => (
          <Card key={ticket.id} className="p-5 flex flex-col md:flex-row gap-6 border-l-4" style={{
            borderLeftColor: ticket.status === 'Reported' ? '#fbbf24' : ticket.status === 'In Progress' ? '#60a5fa' : '#34d399'
          }}>
            {ticket.photoUrl && (
              <img src={ticket.photoUrl} alt="Issue" className="w-32 h-32 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{ticket.title}</h3>
                  <span className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{ticket.description}</p>
                <div className="mt-2 text-xs font-medium text-slate-500">Reporter: {ticket.reportedBy}</div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium mr-2">Status:</span>
                {(["Reported", "In Progress", "Fixed"] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => updateTicket.mutate({ id: ticket.id, data: { status } })}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                      ticket.status === status 
                        ? "bg-slate-800 text-white border-slate-800 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
