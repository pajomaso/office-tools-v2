import React, { useState, useEffect, useRef } from "react";
import { Clock, Sun, Calendar, Monitor, ArrowRight, Check } from "lucide-react";

type Step = 1 | 2;

type DurationOption = "popping-in" | "half-day" | "all-day" | "remote" | null;

export function TwoStepCheckIn() {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("Jane");
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
      // Focus input when on step 1 (with a slight delay for transition)
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleContinue = () => {
    if (name.trim()) {
      setDirection("forward");
      setIsTransitioning(true);
      setTimeout(() => {
        setStep(2);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleBack = () => {
    setDirection("backward");
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(1);
      setIsTransitioning(false);
    }, 300);
  };

  const handleSubmit = () => {
    // In a real app, this would submit the data
    console.log("Submitting:", { name, duration: selectedDuration });
    // Reset for demo purposes or show success
  };

  const durationOptions = [
    { id: "popping-in", label: "Just popping in", icon: Clock },
    { id: "half-day", label: "Half day", icon: Sun },
    { id: "all-day", label: "All day", icon: Calendar },
    { id: "remote", label: "Remote — just booking", icon: Monitor },
  ] as const;

  return (
    <div className="w-[520px] h-[680px] bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden relative border border-[#222222]">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#045CFC]/5 to-transparent pointer-events-none" />
      
      {/* Top Header & Progress */}
      <div className="pt-10 px-10 pb-6 flex justify-between items-center z-10">
        <div className="text-[#82AEFE] text-sm font-medium tracking-wide">
          CHECK-IN
        </div>
        <div className="flex gap-2">
          <div className={`w-2 h-2 transition-colors duration-300 ${step === 1 ? "bg-[#045CFC]" : "bg-[#222222]"}`} />
          <div className={`w-2 h-2 transition-colors duration-300 ${step === 2 ? "bg-[#045CFC]" : "bg-[#222222]"}`} />
        </div>
      </div>

      {/* Main Content Area - with transition container */}
      <div className="flex-1 relative overflow-hidden px-10">
        
        {/* Step 1: Name */}
        <div 
          className={`absolute top-0 left-10 right-10 bottom-0 flex flex-col transition-all duration-300 ease-in-out ${
            step === 1 
              ? isTransitioning && direction === "forward" ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
              : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex-1 flex flex-col justify-center pb-20">
            <h1 className="text-5xl font-serif text-white mb-8 leading-tight tracking-tight" style={{ fontFamily: '"DM Serif Display", serif' }}>
              What's your name?
            </h1>
            
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                placeholder="e.g. Jane Doe"
                className="w-full bg-transparent border-b-2 border-[#222222] text-3xl py-4 text-white placeholder:text-[#222222] focus:outline-none focus:border-[#045CFC] transition-colors"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>

          <div className="pb-10">
            <button
              onClick={handleContinue}
              disabled={!name.trim()}
              className="w-full bg-[#045CFC] hover:bg-[#045CFC]/90 disabled:bg-[#222222] disabled:text-gray-500 text-white py-4 px-6 flex items-center justify-between transition-colors font-medium text-lg"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step 2: Context */}
        <div 
          className={`absolute top-0 left-10 right-10 bottom-0 flex flex-col transition-all duration-300 ease-in-out ${
            step === 2 
              ? isTransitioning && direction === "backward" ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex-1 flex flex-col pt-8">
            <h1 className="text-4xl font-serif text-white mb-2 leading-tight tracking-tight" style={{ fontFamily: '"DM Serif Display", serif' }}>
              How long are you in today?
            </h1>
            <p className="text-gray-400 mb-8 text-sm">
              We'll use this to suggest the best rooms and resources. Optional.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              {durationOptions.map((option) => {
                const isSelected = selectedDuration === option.id;
                const Icon = option.icon;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedDuration(option.id as DurationOption)}
                    className={`relative p-5 border flex flex-col items-start justify-between h-32 text-left transition-colors ${
                      isSelected 
                        ? "border-[#045CFC] bg-[#045CFC]/10" 
                        : "border-[#222222] bg-[#121212] hover:border-[#045CFC]/50 hover:bg-[#121212]/80"
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${isSelected ? "text-[#82AEFE]" : "text-gray-400"}`} />
                    <span className={`font-medium ${isSelected ? "text-white" : "text-gray-300"}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <div className="absolute top-4 right-4 text-[#82AEFE]">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pb-10 flex gap-4">
            <button
              onClick={handleBack}
              className="px-6 py-4 border border-[#222222] text-white hover:bg-[#121212] transition-colors font-medium text-lg"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-[#045CFC] hover:bg-[#045CFC]/90 text-white py-4 px-6 flex items-center justify-center gap-2 transition-colors font-medium text-lg"
            >
              <span>Get started</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
