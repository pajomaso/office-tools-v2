import React, { useState, useEffect, useRef } from "react";

export function TheGate() {
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (name.trim()) {
      setIsSubmitted(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && name.trim()) {
      handleSubmit();
    }
  };

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  if (isSubmitted) {
    return (
      <div className="w-full h-full min-h-[680px] bg-[#0a0a0a] flex flex-col items-center justify-center text-white font-sans p-8 transition-opacity duration-1000">
        <div className="w-full max-w-md animate-pulse">
          <div className="w-8 h-[2px] bg-[#045CFC] mb-8 mx-auto" />
          <h1 className="text-center text-3xl md:text-4xl font-serif tracking-widest uppercase mb-4 opacity-50 text-white">
            Access Granted
          </h1>
          <p className="text-center text-[#82AEFE] tracking-widest text-sm uppercase">
            Welcome, {name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full min-h-[680px] bg-[#0a0a0a] flex flex-col justify-center text-white p-8 md:p-16"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="w-full max-w-lg mx-auto flex flex-col">
        {/* Logo mark / Horizontal rule */}
        <div className="w-16 h-[3px] bg-[#045CFC] mb-10" />

        {/* Title */}
        <h1 
          className="text-4xl md:text-6xl font-serif uppercase tracking-widest leading-none mb-24 text-white"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          The Office<br />Engine
        </h1>

        {/* Input Area */}
        <div className="flex flex-col space-y-2">
          <label 
            htmlFor="name-input" 
            className={`text-sm tracking-wider uppercase transition-colors duration-300 ${isFocused || name ? 'text-[#82AEFE]' : 'text-gray-500'}`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            your name, please &rarr;
          </label>
          
          <div className="relative">
            <input
              ref={inputRef}
              id="name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-0 border-b-2 border-[#222222] text-2xl md:text-3xl text-white py-3 px-0 focus:outline-none focus:ring-0 focus:border-[#045CFC] transition-colors duration-300 placeholder:text-[#222222]"
              placeholder=""
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Keyboard Hint */}
        <div className="mt-8 flex items-center h-8">
          <span 
            className={`text-xs tracking-[0.2em] uppercase transition-all duration-500 flex items-center gap-2 ${
              name.trim() 
                ? 'opacity-100 text-white translate-y-0' 
                : 'opacity-0 text-gray-700 translate-y-2'
            }`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Press Enter <span className="text-[#045CFC] text-lg font-light leading-none">&crarr;</span>
          </span>
        </div>
      </div>
    </div>
  );
}
