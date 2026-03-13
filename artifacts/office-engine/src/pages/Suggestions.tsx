import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSuggestions,
  useCreateSuggestion,
  useUpdateSuggestion,
  useDeleteSuggestion,
  getGetSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Lightbulb, Plus, MessageSquare, CheckCircle2, Clock, XCircle,
  Trash2, ChevronDown, ChevronUp, Send, Tag, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";

const CATEGORIES = ["General", "Workplace", "Perks", "Process", "Safety", "Other"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  "Open":          { label: "Open",          color: "bg-blue-100 text-blue-700 border-blue-200",   icon: Lightbulb },
  "Under Review":  { label: "Under Review",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  "Implemented":   { label: "Implemented",   color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  "Declined":      { label: "Declined",      color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle },
};

const CATEGORY_COLORS: Record<string, string> = {
  "General":   "bg-slate-100 text-slate-700",
  "Workplace": "bg-indigo-100 text-indigo-700",
  "Perks":     "bg-pink-100 text-pink-700",
  "Process":   "bg-orange-100 text-orange-700",
  "Safety":    "bg-red-100 text-red-700",
  "Other":     "bg-gray-100 text-gray-700",
};

export default function Suggestions() {
  const { userName, isAdmin } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState<string>("General");

  // Admin reply state
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<string>("");

  const { data: suggestions = [], isLoading } = useGetSuggestions();

  const createSuggestion = useCreateSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuggestionsQueryKey() });
        toast({ title: "Suggestion submitted!", description: "Thank you for your feedback." });
        setShowForm(false);
        setFormTitle(""); setFormBody(""); setFormCategory("General");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to submit suggestion" }),
    }
  });

  const updateSuggestion = useUpdateSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuggestionsQueryKey() });
        toast({ title: "Updated!" });
        setReplyId(null); setReplyText(""); setReplyStatus("");
      },
    }
  });

  const deleteSuggestion = useDeleteSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuggestionsQueryKey() });
        toast({ title: "Suggestion removed" });
      }
    }
  });

  const handleSubmit = () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    createSuggestion.mutate({
      data: { title: formTitle.trim(), body: formBody.trim(), category: formCategory as any, submittedBy: userName }
    });
  };

  const handleAdminReply = (id: number) => {
    updateSuggestion.mutate({
      id,
      data: {
        ...(replyStatus ? { status: replyStatus as any } : {}),
        ...(replyText.trim() ? { adminReply: replyText.trim() } : {}),
      }
    });
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterCategory !== "all" && s.category !== filterCategory) return false;
    return true;
  });

  const openForReply = suggestions.find(s => s.id === replyId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Suggestions Box</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Review and respond to staff suggestions." : "Share ideas to improve our workplace."}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl h-11 px-5">
            <Plus className="w-4 h-4" /> Share an Idea
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon;
          const count = suggestions.filter(s => s.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                filterStatus === status ? "ring-2 ring-primary shadow-sm" : "bg-white/60 hover:bg-white",
                "cursor-pointer"
              )}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cfg.color.split(" ")[0])}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-all", filterStatus === "all" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary")}
          >
            All statuses
          </button>
          {Object.keys(STATUS_CONFIG).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={cn("text-xs px-3 py-1.5 rounded-full border transition-all", filterStatus === s ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary")}
            >{s}</button>
          ))}
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-36 h-8 rounded-full text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Suggestion List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-16 animate-pulse">Loading suggestions...</div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Lightbulb className="w-12 h-12 mx-auto opacity-20 mb-4" />
          <p className="text-lg font-medium">No suggestions yet</p>
          <p className="text-sm mt-1">Be the first to share an idea!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuggestions.map(suggestion => {
            const status = STATUS_CONFIG[suggestion.status] ?? STATUS_CONFIG["Open"];
            const StatusIcon = status.icon;
            const isExpanded = expandedId === suggestion.id;

            return (
              <Card key={suggestion.id} className={cn(
                "overflow-hidden transition-all border",
                isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"
              )}>
                <button
                  className="w-full text-left p-5 flex items-start gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                >
                  <div className={cn("mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", status.color.split(" ")[0])}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{suggestion.title}</h3>
                      <Badge variant="outline" className={cn("text-xs", STATUS_CONFIG[suggestion.status]?.color)}>
                        {suggestion.status}
                      </Badge>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORY_COLORS[suggestion.category] ?? "bg-gray-100 text-gray-700")}>
                        {suggestion.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{suggestion.submittedBy}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(suggestion.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {suggestion.adminReply && <MessageSquare className="w-4 h-4 text-primary" title="Has admin reply" />}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4">
                    <p className="text-sm text-foreground leading-relaxed">{suggestion.body}</p>

                    {suggestion.adminReply && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
                          <MessageSquare className="w-3.5 h-3.5" /> Admin Response
                        </div>
                        <p className="text-sm text-foreground">{suggestion.adminReply}</p>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          variant="outline" size="sm" className="gap-1.5 rounded-lg"
                          onClick={() => { setReplyId(suggestion.id); setReplyText(suggestion.adminReply ?? ""); setReplyStatus(suggestion.status); }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Reply & Update Status
                        </Button>
                        <Button
                          variant="outline" size="sm" className="gap-1.5 rounded-lg text-destructive hover:text-destructive"
                          onClick={() => deleteSuggestion.mutate({ id: suggestion.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit Suggestion Modal */}
      <Dialog open={showForm} onOpenChange={open => !open && setShowForm(false)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="w-5 h-5 text-primary" /> Share Your Idea
            </DialogTitle>
            <DialogDescription>Your feedback helps make this a better workplace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="One line summary of your idea"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Details</label>
              <Textarea
                placeholder="Describe your idea in detail. What problem does it solve? How would it work?"
                value={formBody}
                onChange={e => setFormBody(e.target.value)}
                className="rounded-xl resize-none h-28"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Submitted by</label>
              <Input value={userName} disabled className="h-11 rounded-xl bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} className="h-11 rounded-xl">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formTitle.trim() || !formBody.trim() || createSuggestion.isPending}
              className="h-11 rounded-xl gap-2 px-6"
            >
              <Send className="w-4 h-4" />
              {createSuggestion.isPending ? "Submitting..." : "Submit Suggestion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Reply Modal */}
      <Dialog open={!!replyId} onOpenChange={open => !open && setReplyId(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Respond to Suggestion</DialogTitle>
            <DialogDescription>{openForReply?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Update Status</label>
              <Select value={replyStatus} onValueChange={setReplyStatus}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Admin Reply</label>
              <Textarea
                placeholder="Write a response to the person who submitted this..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="rounded-xl resize-none h-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyId(null)} className="h-11 rounded-xl">Cancel</Button>
            <Button
              onClick={() => replyId && handleAdminReply(replyId)}
              disabled={updateSuggestion.isPending}
              className="h-11 rounded-xl gap-2 px-6"
            >
              <Send className="w-4 h-4" />
              {updateSuggestion.isPending ? "Saving..." : "Save Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
