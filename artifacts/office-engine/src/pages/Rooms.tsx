import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetRooms, 
  useGetBookings, 
  useCreateBooking, 
  useDeleteBooking,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { Building2, Calendar, Clock, MapPin, Users, Trash2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const DAY_START = "08:00";
const DAY_END = "18:00";

// All half-hour slots from 08:00 to 18:00
const ALL_SLOTS: string[] = [];
for (let h = 8; h <= 18; h++) {
  ALL_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 18) ALL_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
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
  { label: "All day",    minutes: -1 }, // special
];

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(Math.min(endH, 18)).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export default function Rooms() {
  const { userName, isAdmin } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
    }, 30000);
    return () => clearInterval(id);
  }, [queryClient]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { data: rooms = [], isLoading: loadingRooms } = useGetRooms();
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const { data: bookings = [], isLoading: loadingBookings } = useGetBookings({ 
    date: dateStr,
    roomId: activeRoomId || undefined
  });

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
        toast({ title: "Booking confirmed!", description: "Your room has been reserved." });
        setBookingModal(null);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Booking failed", description: err.message || "Slot might be taken." });
      }
    }
  });

  const deleteBooking = useDeleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
        toast({ title: "Booking cancelled" });
      }
    }
  });

  if (rooms.length > 0 && activeRoomId === null) {
    setActiveRoomId(rooms[0].id);
  }

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(start, i));

  const [bookingModal, setBookingModal] = useState<{room: any, date: Date, time: string} | null>(null);
  const [startTime, setStartTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState(60);

  const openBookingModal = (room: any, date: Date, time: string) => {
    setBookingModal({ room, date, time });
    setStartTime(time);
    setDurationMinutes(60);
  };

  const computedEndTime = durationMinutes === -1 ? DAY_END : addMinutesToTime(startTime, durationMinutes);

  // Valid start slots: anything before DAY_END, with at least 30 min remaining
  const validStartSlots = ALL_SLOTS.filter(s => s < DAY_END);

  const handleBook = () => {
    if (!bookingModal) return;
    const endTime = durationMinutes === -1 ? DAY_END : addMinutesToTime(startTime, durationMinutes);
    createBooking.mutate({
      data: {
        roomId: bookingModal.room.id,
        userName,
        title: userName,
        date: format(bookingModal.date, 'yyyy-MM-dd'),
        startTime: durationMinutes === -1 ? DAY_START : startTime,
        endTime,
      }
    });
  };

  const getBookingForSlot = (date: Date, time: string) => {
    const dStr = format(date, 'yyyy-MM-dd');
    const slotEnd = addMinutesToTime(time, 60);
    // Show a booking in this slot if it overlaps (starts before slot ends AND ends after slot starts)
    return bookings.find(b => {
      if (b.date !== dStr) return false;
      return b.startTime < slotEnd && b.endTime > time;
    });
  };

  // Returns true if this is the first slot where the booking appears (to know where to show the title)
  const isBookingStart = (booking: any, time: string) => {
    const prevSlotTime = HOURS[HOURS.indexOf(time) - 1];
    if (!prevSlotTime) return true;
    const prevSlotEnd = addMinutesToTime(prevSlotTime, 60);
    // If the booking started before the current slot start, it was visible in a previous slot
    return booking.startTime >= time || booking.startTime >= prevSlotEnd;
  };

  if (loadingRooms) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading rooms...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Room Booking</h1>
          <p className="text-muted-foreground mt-1">Reserve a space for your next meeting.</p>
        </div>
      </div>

      {/* Room Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map(room => (
          <Card 
            key={room.id}
            className={cn(
              "overflow-hidden cursor-pointer transition-all duration-300 border-2",
              activeRoomId === room.id 
                ? "border-primary shadow-lg ring-4 ring-primary/10" 
                : "border-transparent hover:border-border hover:shadow-md opacity-80 hover:opacity-100"
            )}
            onClick={() => setActiveRoomId(room.id)}
          >
            <div className="h-32 bg-muted relative">
              {room.photoUrl ? (
                <img src={room.photoUrl} alt={room.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                  <Building2 className="w-10 h-10 text-slate-300" />
                </div>
              )}
              {activeRoomId === room.id && (
                <div className="absolute top-2 right-2 bg-primary text-white p-1 rounded-full shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg">{room.name}</h3>
              <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                <span className="flex items-center gap-1"><Users className="w-4 h-4"/> {room.capacity}</span>
                {room.description && <span className="flex items-center gap-1 truncate"><MapPin className="w-4 h-4 shrink-0"/> <span className="truncate">{room.description}</span></span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar View */}
      {activeRoom && (
        <Card className="p-6 rounded-2xl shadow-sm border-border/50 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            {/* Clickable date header with popover calendar */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 group hover:text-primary transition-colors rounded-lg px-2 py-1 -mx-2 hover:bg-primary/5">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">
                    {format(start, 'MMMM yyyy')}
                  </h2>
                  <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-normal ml-1">
                    Week of {format(start, 'MMM d')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-border" align="start">
                <div className="p-3 border-b border-border/50 bg-muted/30 rounded-t-2xl">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jump to a date</p>
                </div>
                <CalendarWidget
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) { setSelectedDate(date); setCalendarOpen(false); }
                  }}
                  initialFocus
                  className="p-3"
                />
              </PopoverContent>
            </Popover>

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-lg" onClick={() => setSelectedDate(d => subWeeks(d, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg px-4" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="rounded-lg" onClick={() => setSelectedDate(d => addWeeks(d, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-6 border-b border-border pb-4 mb-4 gap-4">
                <div className="font-medium text-muted-foreground text-sm flex items-end">Time</div>
                {weekDays.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedDate(day); setCalendarOpen(false); }}
                    className={cn(
                      "text-center p-2 rounded-xl transition-all hover:bg-primary/5 cursor-pointer",
                      isSameDay(day, new Date()) ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/30" : "text-foreground hover:text-primary"
                    )}
                  >
                    <div className="text-xs uppercase tracking-wider opacity-70 mb-1">{format(day, 'EEE')}</div>
                    <div className="text-2xl">{format(day, 'd')}</div>
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="relative">
                {loadingBookings && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                    <span className="animate-pulse font-medium">Updating...</span>
                  </div>
                )}
                
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-6 gap-4 py-2 border-b border-border/30 last:border-0 group">
                    <div className="text-sm text-muted-foreground font-medium flex items-center">
                      <Clock className="w-3 h-3 mr-1.5 opacity-50"/>
                      {formatTime(hour)}
                    </div>
                    
                    {weekDays.map((day, i) => {
                      const booking = getBookingForSlot(day, hour);
                      const isPast = day < new Date(new Date().setHours(0,0,0,0));
                      const isFirstSlot = booking ? isBookingStart(booking, hour) : false;
                      const isMine = booking?.userName === userName;
                      
                      return (
                        <div key={i} className="h-16 relative">
                          {booking ? (
                            <div className={cn(
                              "absolute inset-0 px-2 py-1 overflow-hidden transition-all",
                              isFirstSlot ? "rounded-xl shadow-sm" : "border-l-2",
                              isMine
                                ? isFirstSlot ? "bg-primary text-primary-foreground" : "bg-primary/80 text-primary-foreground border-primary-foreground/30"
                                : isFirstSlot ? "bg-slate-100 border border-slate-200 text-slate-800" : "bg-slate-100 text-slate-600 border-slate-300"
                            )}>
                              {isFirstSlot && (
                                <div>
                                  <p className="text-xs font-bold truncate leading-tight">{booking.userName}</p>
                                  <p className={cn("text-[10px] truncate", isMine ? "text-primary-foreground/80" : "text-slate-500")}>
                                    {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
                                  </p>
                                </div>
                              )}
                              {(isMine || isAdmin) && isFirstSlot && (
                                <button 
                                  onClick={() => deleteBooking.mutate({ id: booking.id })}
                                  className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition-colors"
                                  title="Cancel booking"
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
                                "absolute inset-0 w-full rounded-xl border border-dashed border-border/50 flex items-center justify-center transition-all",
                                isPast 
                                  ? "bg-muted/30 cursor-not-allowed opacity-50" 
                                  : "hover:border-primary hover:bg-primary/5 cursor-pointer opacity-0 group-hover:opacity-100"
                              )}
                            >
                              <span className="text-xs font-medium text-primary">Book Slot</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Booking Modal */}
      <Dialog open={!!bookingModal} onOpenChange={(open) => !open && setBookingModal(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Book {bookingModal?.room.name}</DialogTitle>
            <DialogDescription>
              {bookingModal && format(bookingModal.date, 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start time</label>
                <Select
                  value={durationMinutes === -1 ? DAY_START : startTime}
                  onValueChange={(v) => setStartTime(v)}
                  disabled={durationMinutes === -1}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validStartSlots.map(slot => (
                      <SelectItem key={slot} value={slot}>
                        {formatTime(slot)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <Select
                  value={String(durationMinutes)}
                  onValueChange={(v) => setDurationMinutes(Number(v))}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.minutes} value={String(opt.minutes)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary pill */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium">
              <Clock className="h-4 w-4 shrink-0" />
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
            <Button 
              onClick={handleBook} 
              disabled={createBooking.isPending}
              className="h-12 rounded-xl px-8"
            >
              {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
