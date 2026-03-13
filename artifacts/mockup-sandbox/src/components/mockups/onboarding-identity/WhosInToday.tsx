import React, { useState } from "react";
import { Plus, ArrowRight, User } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: "1", name: "Ana Rodrigues", role: "Design", initials: "AR" },
  { id: "2", name: "Bruno Coelho", role: "Engineering", initials: "BC" },
  { id: "3", name: "Clara Santos", role: "Product", initials: "CS" },
  { id: "4", name: "David Ferreira", role: "Marketing", initials: "DF" },
  { id: "5", name: "Elena Costa", role: "Operations", initials: "EC" },
  { id: "6", name: "Francisco Lima", role: "Engineering", initials: "FL" },
  { id: "7", name: "Gabriela Nunes", role: "Design", initials: "GN" },
  { id: "8", name: "Hugo Mendes", role: "Finance", initials: "HM" },
];

export function WhosInToday() {
  const [selectedId, setSelectedId] = useState<string | null>("3"); // Clara selected by default as per brief
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowAddForm(false);
  };

  const handleShowAddForm = () => {
    setShowAddForm(true);
    setSelectedId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = selectedId || (showAddForm && customName.trim().length > 0);
    if (!isValid) return;

    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  const isFormValid = selectedId !== null || (showAddForm && customName.trim().length > 0);

  if (submitted) {
    return (
      <div className="w-[520px] h-[680px] bg-[#0a0a0a] border border-[#222222] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[#045CFC]/5 pointer-events-none"></div>
        <div className="w-16 h-16 bg-[#045CFC] flex items-center justify-center mb-6">
          <ArrowRight className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl text-white font-serif mb-2" style={{ fontFamily: '"DM Serif Display", serif' }}>
          You're checked in
        </h1>
        <p className="text-[#82AEFE] text-lg">
          Welcome to the workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="w-[520px] h-[680px] bg-[#0a0a0a] border border-[#222222] flex flex-col font-sans relative overflow-hidden text-gray-200">
      {/* Top Banner/Header */}
      <div className="p-8 pb-6 border-b border-[#222222] bg-[#121212] shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 bg-[#045CFC]"></div>
          <h2 className="text-xs font-semibold tracking-widest text-[#82AEFE] uppercase">
            Workspace Sign-in
          </h2>
        </div>
        <h1 className="text-4xl text-white mt-4" style={{ fontFamily: '"DM Serif Display", serif' }}>
          Who's in today?
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Select your name to check into the workspace, or add yourself if you're new.
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
        <div className="grid grid-cols-2 gap-4">
          {TEAM_MEMBERS.map((member) => {
            const isSelected = selectedId === member.id;
            return (
              <button
                key={member.id}
                onClick={() => handleSelect(member.id)}
                className={`flex items-center gap-3 p-3 border text-left transition-all duration-200 ${
                  isSelected
                    ? "bg-[#045CFC] border-[#045CFC] text-white shadow-[0_0_20px_rgba(4,92,252,0.3)]"
                    : "bg-[#121212] border-[#222222] hover:border-[#82AEFE] text-gray-300"
                }`}
              >
                <div
                  className={`w-10 h-10 flex items-center justify-center shrink-0 text-sm font-bold ${
                    isSelected ? "bg-white text-[#045CFC]" : "bg-[#045CFC] text-white"
                  }`}
                >
                  {member.initials}
                </div>
                <div className="overflow-hidden">
                  <div className={`font-medium truncate ${isSelected ? "text-white" : "text-gray-200"}`}>
                    {member.name}
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${isSelected ? "text-blue-100" : "text-gray-500"}`}>
                    {member.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {!showAddForm ? (
            <button
              onClick={handleShowAddForm}
              className="flex items-center justify-center gap-2 w-full p-4 border border-dashed border-[#222222] hover:border-[#82AEFE] hover:text-[#82AEFE] text-gray-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Not listed? Add yourself</span>
            </button>
          ) : (
            <div className="p-4 border border-[#045CFC] bg-[#121212] animate-in fade-in slide-in-from-top-2 duration-300">
              <label htmlFor="customName" className="block text-xs font-semibold text-[#82AEFE] uppercase tracking-wider mb-2">
                Your Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-[#0a0a0a] border border-[#222222] focus:border-[#045CFC] focus:outline-none focus:ring-1 focus:ring-[#045CFC] text-white px-4 py-3 pl-10 transition-colors"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="p-8 border-t border-[#222222] bg-[#121212] shrink-0">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className={`w-full h-14 flex items-center justify-center gap-2 font-bold tracking-wide transition-all ${
            isFormValid
              ? "bg-[#045CFC] hover:bg-blue-600 text-white shadow-[0_4px_14px_rgba(4,92,252,0.4)]"
              : "bg-[#222222] text-gray-500 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin"></div>
          ) : (
            <>
              CHECK IN
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
