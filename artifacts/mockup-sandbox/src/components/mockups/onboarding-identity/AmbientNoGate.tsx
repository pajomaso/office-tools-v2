import { useState } from "react";
import { ArrowRight, Building2, Calendar, Coffee, Plus, Search, User } from "lucide-react";

export function AmbientNoGate() {
  const [name, setName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsSubmitted(true);
    }
  };

  return (
    <div className="w-[520px] h-[680px] bg-[#0a0a0a] text-white relative overflow-hidden font-sans flex flex-col border border-[#222]">
      {/* Top Banner (Identity Capture) */}
      {!isSubmitted && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#121212] border-b border-[#222] shadow-2xl">
          <form onSubmit={handleSubmit} className="px-4 py-3 flex items-center gap-3">
            <div className="w-6 h-6 bg-[#045CFC]/20 border border-[#045CFC]/50 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-[#82AEFE]" />
            </div>
            <p className="text-sm text-gray-400 whitespace-nowrap">
              You're browsing as a guest.
            </p>
            <div className="flex-1 flex items-center ml-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-black border border-[#222] text-sm px-3 py-1.5 focus:outline-none focus:border-[#045CFC] transition-colors text-white placeholder:text-gray-600"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="shrink-0 bg-[#045CFC] hover:bg-[#045CFC]/90 text-white disabled:bg-[#222] disabled:text-gray-500 px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 rounded-none"
            >
              Go <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}

      {/* Background Dashboard Mockup */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-700 ${
          !isSubmitted ? "opacity-30 grayscale blur-[2px] pointer-events-none mt-14" : "opacity-100 mt-0"
        }`}
      >
        <header className="px-6 py-5 border-b border-[#222] bg-[#121212] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0a0a0a] border border-[#222] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#82AEFE]" />
            </div>
            <h1 className="font-serif text-xl tracking-wide uppercase">The Office Engine</h1>
          </div>
          {isSubmitted && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#222] flex items-center justify-center">
                <span className="text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}
        </header>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-[#0a0a0a] scrollbar-hide">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif">Quick Actions</h2>
            <div className="flex gap-2">
              <button className="bg-[#121212] border border-[#222] p-2 hover:bg-[#222] transition-colors rounded-none">
                <Search className="w-4 h-4 text-gray-400" />
              </button>
              <button className="bg-[#045CFC] p-2 hover:bg-[#045CFC]/90 transition-colors rounded-none">
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Room Booking Card */}
            <div className="bg-[#121212] border border-[#222] p-4 flex flex-col h-40 group hover:border-[#045CFC]/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-[#045CFC]/10 border border-[#045CFC]/30 flex items-center justify-center mb-auto group-hover:bg-[#045CFC]/20 transition-colors">
                <Calendar className="w-5 h-5 text-[#82AEFE]" />
              </div>
              <div>
                <h3 className="font-serif text-lg mb-1">Book a Room</h3>
                <p className="text-xs text-gray-500">Find an available meeting space</p>
              </div>
            </div>

            {/* Pantry Request Card */}
            <div className="bg-[#121212] border border-[#222] p-4 flex flex-col h-40 group hover:border-[#045CFC]/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-[#222] border border-[#333] flex items-center justify-center mb-auto group-hover:bg-[#333] transition-colors">
                <Coffee className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <h3 className="font-serif text-lg mb-1">Pantry Request</h3>
                <p className="text-xs text-gray-500">Order snacks and beverages</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-serif">Upcoming Schedule</h2>
            <div className="bg-[#121212] border border-[#222] divide-y divide-[#222]">
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-black border border-[#222] flex flex-col items-center justify-center">
                  <span className="text-xs text-[#82AEFE] font-bold uppercase">Oct</span>
                  <span className="text-sm font-bold">24</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Design Review</h4>
                  <p className="text-xs text-gray-500">Boardroom Alpha • 10:00 AM</p>
                </div>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-black border border-[#222] flex flex-col items-center justify-center">
                  <span className="text-xs text-[#82AEFE] font-bold uppercase">Oct</span>
                  <span className="text-sm font-bold">24</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">All Hands Sync</h4>
                  <p className="text-xs text-gray-500">Main Atrium • 2:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
