import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRooms, useGetBookings, useCreateBooking, useDeleteBooking,
  getGetBookingsQueryKey,
  useCreateInventoryRequest, getGetInventoryRequestsQueryKey,
  useCreateMaintenanceTicket, getGetMaintenanceTicketsQueryKey,
  useGetSuggestions, useCreateSuggestion, getGetSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import {
  Calendar, Coffee, Wrench, Lightbulb,
  ChevronLeft, ChevronRight, Clock, Trash2,
  Send, Plus, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatTime, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const HOURS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
const DAY_START = "08:00";
const DAY_END = "18:00";
const ALL_SLOTS: string[] = [];
for (let h = 8; h <= 18; h++) {
  ALL_SLOTS.push(`${String(h).padStart(2,"0")}:00`);
  if (h < 18) ALL_SLOTS.push(`${String(h).padStart(2,"0")}:30`);
}
const DURATION_OPTIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour",     minutes: 60 },
  { label: "1.5 hours",  minutes: 90 },
  { label: "2 hours",    minutes: 120 },
  { label: "2.5 hours",  minutes: 150 },
  { label: "3 hours",    minutes: 180 },
  { label: "4 hours",    minutes: 240 },
  { label: "Half day",   minutes: 300 },
  { label: "All day",    minutes: -1  },
];
function addMinutesToTime(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const eH = Math.min(Math.floor(total / 60), 18);
  const eM = total % 60;
  return `${String(eH).padStart(2,"0")}:${String(eM).padStart(2,"0")}`;
}
function timesOverlap(aS: string, aE: string, bS: string, bE: string) {
  return aS < bE && bS < aE;
}

const PRIORITY_OPTS = ["Low","Medium","High","Critical"];
const CATEGORY_OPTS = ["General","Workplace","Perks","Process","Safety","Other"];
const STATUS_COLORS: Record<string,string> = {
  "Open": "bg-blue-100 text-blue-700",
  "Under Review": "bg-yellow-100 text-yellow-700",
  "Implemented": "bg-green-100 text-green-700",
  "Declined": "bg-red-100 text-red-700",
};

function SectionHeader({ id, icon: Icon, title, subtitle, color }: any) {
  return (
    <div id={id} className="flex items-center gap-4 scroll-mt-24">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const { userName } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Rooms ──────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [bookingModal, setBookingModal] = useState<{ room: any; date: Date; time: string } | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState(60);

  const { data: rooms = [] } = useGetRooms();
  if (rooms.length > 0 && activeRoomId === null) setActiveRoomId(rooms[0].id);
  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

  const { data: bookings = [], isLoading: loadingBookings } = useGetBookings({
    date: format(selectedDate, "yyyy-MM-dd"),
    roomId: activeRoomId || undefined,
  });

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
        toast({ title: "Booking confirmed!" });
        setBookingModal(null);
      },
      onError: () => toast({ variant: "destructive", title: "Booking failed", description: "That slot may be taken." }),
    },
  });

  const deleteBooking = useDeleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
        toast({ title: "Booking cancelled" });
      },
    },
  });

  const computedEndTime = durationMinutes === -1 ? DAY_END : addMinutesToTime(startTime, durationMinutes);

  const openBookingModal = (room: any, date: Date, time: string) => {
    setBookingModal({ room, date, time });
    setStartTime(time);
    setDurationMinutes(60);
    setBookTitle("");
  };

  const handleBook = () => {
    if (!bookingModal || !bookTitle.trim()) return;
    const endTime = durationMinutes === -1 ? DAY_END : addMinutesToTime(startTime, durationMinutes);
    createBooking.mutate({
      data: {
        roomId: bookingModal.room.id,
        userName,
        title: bookTitle.trim(),
        date: format(bookingModal.date, "yyyy-MM-dd"),
        startTime: durationMinutes === -1 ? DAY_START : startTime,
        endTime,
      },
    });
  };

  const getBookingForSlot = (date: Date, time: string) => {
    const dStr = format(date, "yyyy-MM-dd");
    const slotEnd = addMinutesToTime(time, 60);
    return bookings.find(b => b.date === dStr && timesOverlap(b.startTime, b.endTime, time, slotEnd));
  };

  const isBookingFirstSlot = (booking: any, time: string) => {
    const idx = HOURS.indexOf(time);
    if (idx === 0) return true;
    const prev = HOURS[idx - 1];
    const prevEnd = addMinutesToTime(prev, 60);
    return booking.startTime >= time || !timesOverlap(booking.startTime, booking.endTime, prev, prevEnd);
  };

  // ── Inventory ──────────────────────────────────────────────────────────────
  const [invItem, setInvItem] = useState("");
  const [invQty, setInvQty] = useState("1");
  const [invNote, setInvNote] = useState("");

  const createInvReq = useCreateInventoryRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryRequestsQueryKey() });
        toast({ title: "Request submitted!" });
        setInvItem(""); setInvQty("1"); setInvNote("");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to submit request" }),
    },
  });

  // ── Maintenance ────────────────────────────────────────────────────────────
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mPriority, setMPriority] = useState("Medium");
  const [mLocation, setMLocation] = useState("");

  const createTicket = useCreateMaintenanceTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMaintenanceTicketsQueryKey() });
        toast({ title: "Maintenance request logged!" });
        setMTitle(""); setMDesc(""); setMPriority("Medium"); setMLocation("");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to submit request" }),
    },
  });

  // ── Suggestions ────────────────────────────────────────────────────────────
  const [sTitle, setSTitle] = useState("");
  const [sBody, setSBody] = useState("");
  const [sCategory, setSCategory] = useState("General");

  const { data: suggestions = [] } = useGetSuggestions();

  const createSuggestion = useCreateSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuggestionsQueryKey() });
        toast({ title: "Suggestion submitted! Thanks for the input." });
        setSTitle(""); setSBody(""); setSCategory("General");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to submit suggestion" }),
    },
  });

  // ── Scroll spy nav ─────────────────────────────────────────────────────────
  const sections = [
    { id: "rooms", label: "Rooms", icon: Calendar, color: "text-indigo-600" },
    { id: "pantry", label: "Pantry", icon: Coffee, color: "text-amber-600" },
    { id: "maintenance", label: "Fix-It", icon: Wrench, color: "text-red-600" },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb, color: "text-emerald-600" },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-16 pb-24">
      {/* Sticky quick-nav */}
      <div className="sticky top-[65px] z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-background/80 backdrop-blur-md border-b border-border/50 flex gap-2 overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              "bg-muted hover:bg-primary/10 hover:text-primary",
              s.color
            )}
          >
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {/* ── ROOMS ────────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHeader
          id="rooms"
          icon={Calendar}
          title="Room Booking"
          subtitle="Reserve a space for your next meeting."
          color="bg-indigo-100 text-indigo-600"
        />

        {/* Room selector */}
        <div className="flex gap-3 flex-wrap">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                activeRoomId === room.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border hover:border-primary hover:text-primary"
              )}
            >
              {room.name}
              <span className="ml-2 text-xs opacity-60">up to {room.capacity}</span>
            </button>
          ))}
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDate(d => subWeeks(d, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-semibold text-sm">{format(weekStart, "MMMM yyyy")} · Week of {format(weekStart, "MMM d")}</span>
          <button onClick={() => setSelectedDate(d => addWeeks(d, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Calendar grid */}
        <Card className="p-4 rounded-2xl shadow-sm overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-6 gap-3 pb-3 mb-3 border-b border-border">
              <div className="text-xs text-muted-foreground font-medium flex items-end pb-1">Time</div>
              {weekDays.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "text-center p-2 rounded-xl transition-all hover:bg-primary/5",
                    isSameDay(day, new Date()) && "bg-primary/10 text-primary font-bold ring-1 ring-primary/30"
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{format(day, "EEE")}</div>
                  <div className="text-xl font-bold">{format(day, "d")}</div>
                </button>
              ))}
            </div>

            {/* Hourly rows */}
            <div className="relative">
              {loadingBookings && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                  <span className="animate-pulse text-sm font-medium">Loading...</span>
                </div>
              )}
              {HOURS.map(hour => (
                <div key={hour} className="grid grid-cols-6 gap-3 py-1.5 border-b border-border/20 last:border-0 group">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 opacity-40" /> {formatTime(hour)}
                  </div>
                  {weekDays.map((day, i) => {
                    const booking = getBookingForSlot(day, hour);
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                    const isFirst = booking ? isBookingFirstSlot(booking, hour) : false;
                    const isMine = booking?.userName === userName;
                    return (
                      <div key={i} className="h-14 relative">
                        {booking ? (
                          <div className={cn(
                            "absolute inset-0 px-2 py-1 overflow-hidden transition-all",
                            isFirst ? "rounded-xl shadow-sm" : "border-l-2 border-t-0",
                            isMine
                              ? isFirst ? "bg-primary text-primary-foreground" : "bg-primary/80 text-primary-foreground border-primary-foreground/30"
                              : isFirst ? "bg-slate-100 border border-slate-200 text-slate-800" : "bg-slate-100 text-slate-500 border-slate-300"
                          )}>
                            {isFirst && (
                              <>
                                <p className="text-xs font-bold truncate leading-tight">{booking.title}</p>
                                <p className={cn("text-[10px] truncate", isMine ? "opacity-80" : "text-slate-500")}>
                                  {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
                                </p>
                              </>
                            )}
                            {isMine && isFirst && (
                              <button
                                onClick={() => deleteBooking.mutate({ id: booking.id })}
                                className="absolute bottom-1 right-1 p-1 rounded-lg bg-white/20 hover:bg-white/40 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            disabled={isPast}
                            onClick={() => openBookingModal(activeRoom, day, hour)}
                            className={cn(
                              "absolute inset-0 w-full rounded-xl border border-dashed border-border/40 flex items-center justify-center transition-all text-xs font-medium text-primary",
                              isPast ? "opacity-30 cursor-not-allowed" : "opacity-0 group-hover:opacity-100 hover:border-primary hover:bg-primary/5"
                            )}
                          >
                            Book
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* ── PANTRY ───────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHeader
          id="pantry"
          icon={Coffee}
          title="Pantry & Supplies"
          subtitle="Request items you need in the office."
          color="bg-amber-100 text-amber-600"
        />
        <Card className="p-6 rounded-2xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Item name</label>
              <Input
                placeholder="e.g. Coffee pods, sticky notes..."
                value={invItem}
                onChange={e => setInvItem(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min={1}
                value={invQty}
                onChange={e => setInvQty(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="sm:col-span-3 space-y-2">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground">(optional)</span></label>
              <Input
                placeholder="Any brand preference or additional info..."
                value={invNote}
                onChange={e => setInvNote(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <Button
            className="mt-4 rounded-xl h-11 px-6"
            disabled={!invItem.trim() || createInvReq.isPending}
            onClick={() =>
              createInvReq.mutate({
                data: { itemName: invItem.trim(), quantity: parseInt(invQty) || 1, requestedBy: userName, notes: invNote || undefined },
              })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            {createInvReq.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </Card>
      </section>

      {/* ── MAINTENANCE ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHeader
          id="maintenance"
          icon={Wrench}
          title="Report an Issue"
          subtitle="Log a maintenance or facilities request."
          color="bg-red-100 text-red-600"
        />
        <Card className="p-6 rounded-2xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Issue title</label>
              <Input placeholder="e.g. Broken projector" value={mTitle} onChange={e => setMTitle(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input placeholder="e.g. Meeting Room B" value={mLocation} onChange={e => setMLocation(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea placeholder="Describe the issue in detail..." value={mDesc} onChange={e => setMDesc(e.target.value)} className="rounded-xl resize-none" rows={3} />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2 w-48">
              <label className="text-sm font-medium">Priority</label>
              <Select value={mPriority} onValueChange={setMPriority}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="mt-6 rounded-xl h-11 px-6"
              disabled={!mTitle.trim() || createTicket.isPending}
              onClick={() =>
                createTicket.mutate({
                  data: { title: mTitle.trim(), description: mDesc, location: mLocation || undefined, priority: mPriority, reportedBy: userName },
                })
              }
            >
              <Send className="w-4 h-4 mr-2" />
              {createTicket.isPending ? "Logging..." : "Log Issue"}
            </Button>
          </div>
        </Card>
      </section>

      {/* ── SUGGESTIONS ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHeader
          id="suggestions"
          icon={Lightbulb}
          title="Suggestions Box"
          subtitle="Share ideas to improve the workplace."
          color="bg-emerald-100 text-emerald-600"
        />

        {/* Submission form */}
        <Card className="p-6 rounded-2xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input placeholder="Give your idea a title..." value={sTitle} onChange={e => setSTitle(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={sCategory} onValueChange={setSCategory}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Details</label>
            <Textarea placeholder="Describe your idea..." value={sBody} onChange={e => setSBody(e.target.value)} className="rounded-xl resize-none" rows={3} />
          </div>
          <Button
            className="rounded-xl h-11 px-6"
            disabled={!sTitle.trim() || !sBody.trim() || createSuggestion.isPending}
            onClick={() =>
              createSuggestion.mutate({ data: { title: sTitle.trim(), body: sBody.trim(), category: sCategory, submittedBy: userName } })
            }
          >
            <Send className="w-4 h-4 mr-2" />
            {createSuggestion.isPending ? "Submitting..." : "Submit Suggestion"}
          </Button>
        </Card>

        {/* Recent suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent suggestions</h3>
            {suggestions.slice(0, 5).map((s: any) => (
              <Card key={s.id} className="p-4 rounded-2xl shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm">{s.title}</p>
                      <Badge variant="outline" className="text-xs">{s.category}</Badge>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[s.status] || "bg-muted text-muted-foreground")}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{s.body}</p>
                    {s.adminReply && (
                      <div className="mt-2 pl-3 border-l-2 border-primary/30 text-sm text-primary/80 italic">
                        {s.adminReply}
                      </div>
                    )}
                  </div>
                  {s.status === "Implemented" && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                  {s.status === "Declined" && <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── BOOKING DIALOG ───────────────────────────────────────────────── */}
      <Dialog open={!!bookingModal} onOpenChange={open => !open && setBookingModal(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Book {bookingModal?.room?.name}</DialogTitle>
            <DialogDescription>{bookingModal && format(bookingModal.date, "EEEE, MMMM d, yyyy")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Meeting Title</label>
              <Input placeholder="e.g. Sync with Marketing" value={bookTitle} onChange={e => setBookTitle(e.target.value)} autoFocus className="h-12 rounded-xl" onKeyDown={e => e.key === "Enter" && handleBook()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start time</label>
                <Select value={durationMinutes === -1 ? DAY_START : startTime} onValueChange={setStartTime} disabled={durationMinutes === -1}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_SLOTS.filter(s => s < DAY_END).map(slot => (
                      <SelectItem key={slot} value={slot}>{formatTime(slot)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <Select value={String(durationMinutes)} onValueChange={v => setDurationMinutes(Number(v))}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(opt => <SelectItem key={opt.minutes} value={String(opt.minutes)}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium">
              <Clock className="w-4 h-4 shrink-0" />
              {durationMinutes === -1
                ? `All day · ${formatTime(DAY_START)} – ${formatTime(DAY_END)}`
                : `${formatTime(durationMinutes === -1 ? DAY_START : startTime)} – ${formatTime(computedEndTime)}`}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Booked By</label>
              <Input value={userName} disabled className="h-12 rounded-xl bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingModal(null)} className="h-12 rounded-xl">Cancel</Button>
            <Button onClick={handleBook} disabled={!bookTitle.trim() || createBooking.isPending} className="h-12 rounded-xl px-8">
              {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
