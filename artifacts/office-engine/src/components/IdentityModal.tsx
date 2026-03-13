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

export function IdentityModal({
  isOpen,
  onSave,
}: {
  isOpen: boolean;
  onSave: (name: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(null);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<"fwd" | "bwd">("fwd");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && step === 1) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const goNext = () => {
    if (!name.trim()) return;
    setDir("fwd");
    setAnimating(true);
    setTimeout(() => {
      setStep(2);
      setAnimating(false);
    }, 280);
  };

  const goBack = () => {
    setDir("bwd");
    setAnimating(true);
    setTimeout(() => {
      setStep(1);
      setAnimating(false);
    }, 280);
  };

  const handleSubmit = () => {
    if (name.trim()) onSave(name.trim());
  };

  const slideStyle = (forStep: Step): React.CSSProperties => {
    const active = step === forStep;
    if (active) {
      return animating
        ? {
            opacity: 0,
            transform: dir === "fwd" ? "translateX(-32px)" : "translateX(32px)",
            transition: "all 0.28s ease",
          }
        : {
            opacity: 1,
            transform: "translateX(0px)",
            transition: "all 0.28s ease",
          };
    }
    return {
      opacity: 0,
      transform: dir === "fwd" ? "translateX(32px)" : "translateX(-32px)",
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
    };
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(238, 243, 255, 0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Card */}
      <div
        style={{
          width: 480,
          minHeight: 600,
          background: "linear-gradient(160deg, #f7f9ff 0%, #eef3ff 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 8px 48px rgba(4, 92, 252, 0.10), 0 1px 4px rgba(4,92,252,0.06)",
        }}
      >
        {/* Radial glow — the Subvisual website's signature background effect */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            width: 380,
            height: 380,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(130,174,254,0.30) 0%, rgba(130,174,254,0.08) 55%, transparent 75%)",
            pointerEvents: "none",
            filter: "blur(24px)",
          }}
        />

        {/* Header — wordmark + step indicators */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 40px 0",
          }}
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

          {/* Animated pill step dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {([1, 2] as Step[]).map((s) => (
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
        </div>

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            padding: "32px 40px 28px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── Step 1: Name ── */}
          <div
            style={{
              ...slideStyle(1),
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingBottom: 40,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#82AEFE",
                  letterSpacing: "0.06em",
                  marginBottom: 20,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                STEP 1 OF 2
              </p>

              <h1
                style={{
                  fontFamily: '"DM Serif Display", serif',
                  fontSize: 44,
                  lineHeight: 1.08,
                  color: "#045CFC",
                  fontWeight: 400,
                  marginBottom: 32,
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
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "2px solid #045CFC",
                  fontSize: 26,
                  fontFamily: '"DM Serif Display", serif',
                  fontWeight: 400,
                  color: "#045CFC",
                  padding: "6px 0 10px",
                  outline: "none",
                  caretColor: "#045CFC",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Primary button */}
            <button
              onClick={goNext}
              disabled={!name.trim()}
              style={{
                width: "100%",
                background: name.trim() ? "#82AEFE" : "#E5ECFF",
                color: name.trim() ? "#000000" : "#9EB8FE",
                border: "none",
                padding: "15px 24px",
                fontSize: 14,
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
              <ArrowRight size={16} />
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
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#82AEFE",
                  letterSpacing: "0.06em",
                  marginBottom: 20,
                  fontFamily: "Inter, sans-serif",
                }}
              >
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
              <p
                style={{
                  fontSize: 13,
                  color: "#6B7280",
                  marginBottom: 24,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Helps us suggest the right rooms. Optional.
              </p>

              {/* 2×2 option grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  flex: 1,
                }}
              >
                {durationOptions.map(({ id, label, sub, icon: Icon }) => {
                  const selected = selectedDuration === id;
                  return (
                    <button
                      key={id}
                      onClick={() =>
                        setSelectedDuration(
                          selected ? null : (id as DurationOption)
                        )
                      }
                      style={{
                        padding: "16px 14px",
                        border: `1.5px solid ${selected ? "#045CFC" : "#C7D7FE"}`,
                        background: selected
                          ? "rgba(4,92,252,0.05)"
                          : "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 8,
                        transition: "border-color 0.15s, background 0.15s",
                        position: "relative",
                        textAlign: "left",
                      }}
                    >
                      <Icon
                        size={16}
                        style={{ color: selected ? "#045CFC" : "#82AEFE" }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: selected ? "#045CFC" : "#1a1a2e",
                            lineHeight: 1.3,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 2,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {sub}
                        </div>
                      </div>
                      {selected && (
                        <div style={{ position: "absolute", top: 10, right: 10 }}>
                          <Check size={12} style={{ color: "#045CFC" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 actions */}
            <div style={{ display: "flex", gap: 12, paddingTop: 20 }}>
              {/* Secondary — pill (44px radius per Subvisual branding JSON) */}
              <button
                onClick={goBack}
                style={{
                  padding: "13px 24px",
                  background: "transparent",
                  border: "1.5px solid #045CFC",
                  borderRadius: 44,
                  color: "#045CFC",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif",
                  transition: "background 0.15s",
                }}
              >
                Back
              </button>

              {/* Primary — flat 0px radius */}
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  background: "#82AEFE",
                  border: "none",
                  color: "#000000",
                  padding: "13px 24px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Inter, sans-serif",
                  transition: "background 0.15s",
                }}
              >
                Get started
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 40px 20px",
            borderTop: "1px solid rgba(130,174,254,0.20)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "#9EB8FE",
              letterSpacing: "0.08em",
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              textTransform: "uppercase",
            }}
          >
            By Subvisual
          </span>
          {name && (
            <span
              style={{
                fontSize: 11,
                color: "#C7D7FE",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Welcome, {name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
