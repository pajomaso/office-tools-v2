import { useState, useEffect, useRef } from "react";
import { Clock, Sun, Calendar, Monitor, ArrowRight, Check } from "lucide-react";

type Step = 1 | 2;
type DurationOption = "popping-in" | "half-day" | "all-day" | "remote" | null;

const durationOptions = [
  { id: "popping-in", label: "Just popping in", sub: "Under 2 hours", icon: Clock },
  { id: "half-day", label: "Half day", sub: "Morning or afternoon", icon: Sun },
  { id: "all-day", label: "All day", sub: "9am – 6pm", icon: Calendar },
  { id: "remote", label: "Remote today", sub: "Just need to book a room", icon: Monitor },
] as const;

export function TwoStepCheckIn() {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("Jane");
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(null);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<"fwd" | "bwd">("fwd");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1 && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [step]);

  const goNext = () => {
    if (!name.trim()) return;
    setDir("fwd");
    setAnimating(true);
    setTimeout(() => { setStep(2); setAnimating(false); }, 280);
  };

  const goBack = () => {
    setDir("bwd");
    setAnimating(true);
    setTimeout(() => { setStep(1); setAnimating(false); }, 280);
  };

  const slideStyle = (forStep: Step) => {
    const active = step === forStep;
    if (active) {
      return animating
        ? { opacity: 0, transform: dir === "fwd" ? "translateX(-32px)" : "translateX(32px)", transition: "all 0.28s ease" }
        : { opacity: 1, transform: "translateX(0px)", transition: "all 0.28s ease" };
    }
    return { opacity: 0, transform: dir === "fwd" ? "translateX(32px)" : "translateX(-32px)", pointerEvents: "none" as const, position: "absolute" as const, inset: 0 };
  };

  return (
    <div
      className="w-[520px] h-[680px] overflow-hidden relative flex flex-col"
      style={{
        background: "linear-gradient(160deg, #f7f9ff 0%, #eef3ff 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Subvisual radial glow — matches the website's background effect */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(130,174,254,0.28) 0%, rgba(130,174,254,0.08) 55%, transparent 75%)",
          pointerEvents: "none",
          filter: "blur(24px)",
        }}
      />

      {/* Header — wordmark + step dots */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-8 pb-0">
        <span
          className="text-xs font-semibold tracking-[0.18em] uppercase"
          style={{ color: "#82AEFE" }}
        >
          The Office Engine
        </span>

        {/* Step dots */}
        <div className="flex items-center gap-[6px]">
          {([1, 2] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                width: step === s ? 20 : 6,
                height: 6,
                background: step === s ? "#045CFC" : "#C7D7FE",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="relative z-10 flex-1 px-10 pt-10 pb-8 flex flex-col">

        {/* Step 1 */}
        <div style={{ ...slideStyle(1), display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 48 }}>
            <p className="text-sm font-medium mb-5" style={{ color: "#82AEFE", letterSpacing: "0.04em" }}>
              STEP 1 OF 2
            </p>
            <h1
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: 44,
                lineHeight: 1.08,
                color: "#045CFC",
                marginBottom: 32,
                fontWeight: 400,
              }}
            >
              What's your<br />name?
            </h1>

            {/* Underline-only input — matches the branding JSON (transparent bg, no border box) */}
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goNext()}
                placeholder="Your name"
                autoComplete="off"
                spellCheck="false"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "2px solid #045CFC",
                  fontSize: 28,
                  fontFamily: '"DM Serif Display", serif',
                  fontWeight: 400,
                  color: "#045CFC",
                  padding: "8px 0 12px",
                  outline: "none",
                  caretColor: "#045CFC",
                }}
                className="placeholder:text-blue-200"
              />
            </div>
          </div>

          {/* Primary button — #82AEFE bg, black text, 0px radius (from branding JSON) */}
          <button
            onClick={goNext}
            disabled={!name.trim()}
            style={{
              width: "100%",
              background: name.trim() ? "#82AEFE" : "#E5ECFF",
              color: name.trim() ? "#000000" : "#9EB8FE",
              border: "none",
              padding: "16px 24px",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.01em",
              cursor: name.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            <span>Continue</span>
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Step 2 */}
        <div style={{ ...slideStyle(2), display: step === 2 ? "flex" : "none", flexDirection: "column", flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <p className="text-sm font-medium mb-5" style={{ color: "#82AEFE", letterSpacing: "0.04em" }}>
              STEP 2 OF 2
            </p>
            <h1
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: 38,
                lineHeight: 1.1,
                color: "#045CFC",
                marginBottom: 8,
                fontWeight: 400,
              }}
            >
              How long are you<br />in today?
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
              Helps us suggest the right rooms. Optional.
            </p>

            {/* 2×2 option grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
              {durationOptions.map(({ id, label, sub, icon: Icon }) => {
                const selected = selectedDuration === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedDuration(id as DurationOption)}
                    style={{
                      padding: "18px 16px",
                      border: `1.5px solid ${selected ? "#045CFC" : "#C7D7FE"}`,
                      background: selected ? "rgba(4,92,252,0.05)" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 10,
                      transition: "border-color 0.15s, background 0.15s",
                      position: "relative",
                    }}
                  >
                    <Icon
                      size={18}
                      style={{ color: selected ? "#045CFC" : "#82AEFE" }}
                    />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: selected ? "#045CFC" : "#1a1a2e", lineHeight: 1.3 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                        {sub}
                      </div>
                    </div>
                    {selected && (
                      <div style={{ position: "absolute", top: 10, right: 10 }}>
                        <Check size={13} style={{ color: "#045CFC" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 actions */}
          <div style={{ display: "flex", gap: 12, paddingTop: 20 }}>
            {/* Secondary button — pill shape (44px radius, from branding JSON buttonSecondary) */}
            <button
              onClick={goBack}
              style={{
                padding: "14px 24px",
                background: "transparent",
                border: "1.5px solid #045CFC",
                borderRadius: 44,
                color: "#045CFC",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              Back
            </button>

            {/* Primary button — #82AEFE, 0px radius */}
            <button
              onClick={() => {}}
              style={{
                flex: 1,
                background: "#82AEFE",
                border: "none",
                color: "#000000",
                padding: "14px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.15s",
              }}
            >
              Get started
            </button>
          </div>
        </div>

      </div>

      {/* Subvisual wordmark at bottom */}
      <div
        className="relative z-10 px-10 pb-6 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(130,174,254,0.2)", paddingTop: 14 }}
      >
        <span style={{ fontSize: 11, color: "#9EB8FE", letterSpacing: "0.06em", fontWeight: 500 }}>
          BY SUBVISUAL
        </span>
        <span style={{ fontSize: 11, color: "#C7D7FE" }}>
          {name ? `Welcome, ${name}` : "Office workspace"}
        </span>
      </div>
    </div>
  );
}
