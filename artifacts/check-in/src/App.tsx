import { useState, useEffect, useRef } from "react";
import { Clock, Sun, Calendar, Monitor, ArrowRight, Check, CheckCircle2 } from "lucide-react";

type Step = 1 | 2 | "done";
type DurationOption = "popping-in" | "half-day" | "all-day" | "remote" | null;

const durationOptions = [
  { id: "popping-in", label: "Just popping in", sub: "Under 2 hours", icon: Clock },
  { id: "half-day", label: "Half day", sub: "Morning or afternoon", icon: Sun },
  { id: "all-day", label: "All day", sub: "9am – 6pm", icon: Calendar },
  { id: "remote", label: "Remote today", sub: "Just need to book a room", icon: Monitor },
] as const;

function CheckIn() {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(null);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<"fwd" | "bwd">("fwd");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
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

  const handleSubmit = () => {
    if (!name.trim()) return;
    setDir("fwd");
    setAnimating(true);
    setTimeout(() => { setStep("done"); setAnimating(false); }, 280);
  };

  const handleReset = () => {
    setDir("fwd");
    setAnimating(true);
    setTimeout(() => {
      setStep(1);
      setName("");
      setSelectedDuration(null);
      setAnimating(false);
    }, 280);
  };

  const slideStyle = (forStep: Step): React.CSSProperties => {
    const active = step === forStep;
    if (active) {
      return animating
        ? { opacity: 0, transform: dir === "fwd" ? "translateX(-32px)" : "translateX(32px)", transition: "all 0.28s ease" }
        : { opacity: 1, transform: "translateX(0px)", transition: "all 0.28s ease" };
    }
    return {
      opacity: 0,
      transform: dir === "fwd" ? "translateX(32px)" : "translateX(-32px)",
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
    };
  };

  const durationLabel = durationOptions.find(o => o.id === selectedDuration)?.label;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8eeff 100%)" }}
    >
      <div
        className="w-full max-w-[520px] mx-4 flex flex-col overflow-hidden relative"
        style={{
          minHeight: 640,
          background: "linear-gradient(160deg, #f7f9ff 0%, #eef3ff 100%)",
          boxShadow: "0 8px 64px rgba(4,92,252,0.12), 0 1px 4px rgba(4,92,252,0.06)",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            width: 440,
            height: 440,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(130,174,254,0.28) 0%, rgba(130,174,254,0.08) 55%, transparent 75%)",
            pointerEvents: "none",
            filter: "blur(24px)",
          }}
        />

        {/* Header */}
        <div
          className="relative z-10 flex items-center justify-between"
          style={{ padding: "28px 40px 0" }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#82AEFE",
              fontFamily: "Inter, sans-serif",
            }}
          >
            The Office Engine
          </span>

          {step !== "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {([1, 2] as const).map((s) => (
                <div
                  key={s}
                  style={{
                    height: 6,
                    width: step === s ? 20 : 6,
                    background: step === s ? "#045CFC" : "#C7D7FE",
                    transition: "width 0.3s ease, background 0.3s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="relative z-10 flex-1 flex flex-col"
          style={{ padding: "32px 40px 28px", position: "relative" }}
        >

          {/* ── Step 1: Name ── */}
          <div
            style={{
              ...slideStyle(1),
              display: step === 1 || (step !== "done" && animating && dir === "fwd") ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 48 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#82AEFE", letterSpacing: "0.06em", marginBottom: 20, fontFamily: "Inter, sans-serif" }}>
                STEP 1 OF 2
              </p>
              <h1
                style={{
                  fontFamily: '"DM Serif Display", serif',
                  fontSize: 44,
                  lineHeight: 1.08,
                  color: "#045CFC",
                  fontWeight: 400,
                  margin: "0 0 32px",
                }}
              >
                What's your<br />name?
              </h1>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goNext()}
                placeholder="Your name"
                autoComplete="off"
                spellCheck={false}
                className="placeholder:text-blue-200"
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
                  boxSizing: "border-box",
                }}
              />
            </div>

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
                fontFamily: "Inter, sans-serif",
              }}
            >
              <span>Continue</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* ── Step 2: Duration ── */}
          <div
            style={{
              ...slideStyle(2),
              display: step === 2 ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#82AEFE", letterSpacing: "0.06em", marginBottom: 20, fontFamily: "Inter, sans-serif" }}>
                STEP 2 OF 2
              </p>
              <h1
                style={{
                  fontFamily: '"DM Serif Display", serif',
                  fontSize: 38,
                  lineHeight: 1.1,
                  color: "#045CFC",
                  fontWeight: 400,
                  margin: "0 0 8px",
                }}
              >
                How long are you<br />in today?
              </h1>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, fontFamily: "Inter, sans-serif" }}>
                Helps us suggest the right rooms. Optional.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
                {durationOptions.map(({ id, label, sub, icon: Icon }) => {
                  const selected = selectedDuration === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedDuration(selected ? null : id as DurationOption)}
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
                        textAlign: "left",
                      }}
                    >
                      <Icon size={18} style={{ color: selected ? "#045CFC" : "#82AEFE" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? "#045CFC" : "#1a1a2e", lineHeight: 1.3, fontFamily: "Inter, sans-serif" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
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

            <div style={{ display: "flex", gap: 12, paddingTop: 20 }}>
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
                  fontFamily: "Inter, sans-serif",
                  transition: "background 0.15s",
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
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
                  fontFamily: "Inter, sans-serif",
                  transition: "background 0.15s",
                }}
              >
                Get started
              </button>
            </div>
          </div>

          {/* ── Done state ── */}
          <div
            style={{
              ...slideStyle("done"),
              display: step === "done" ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              paddingBottom: 40,
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <CheckCircle2 size={48} style={{ color: "#045CFC" }} />
            </div>
            <h1
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: 40,
                lineHeight: 1.1,
                color: "#045CFC",
                fontWeight: 400,
                margin: "0 0 12px",
              }}
            >
              Welcome,<br />{name}!
            </h1>
            {durationLabel && (
              <p style={{ fontSize: 14, color: "#82AEFE", marginBottom: 8, fontFamily: "Inter, sans-serif" }}>
                {durationLabel}
              </p>
            )}
            <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40, fontFamily: "Inter, sans-serif" }}>
              You're checked in. Have a great day.
            </p>
            <button
              onClick={handleReset}
              style={{
                padding: "13px 32px",
                background: "transparent",
                border: "1.5px solid #C7D7FE",
                borderRadius: 44,
                color: "#82AEFE",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              Check in another person
            </button>
          </div>

        </div>

        {/* Footer */}
        <div
          className="relative z-10 flex items-center justify-between"
          style={{ padding: "12px 40px 22px", borderTop: "1px solid rgba(130,174,254,0.20)" }}
        >
          <span style={{ fontSize: 10, color: "#9EB8FE", letterSpacing: "0.08em", fontWeight: 500, fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
            By Subvisual
          </span>
          {name && step !== 1 && (
            <span style={{ fontSize: 11, color: "#C7D7FE", fontFamily: "Inter, sans-serif" }}>
              {step === "done" ? `Checked in · ${name}` : `Welcome, ${name}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <CheckIn />;
}
