import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2, Square } from "lucide-react";
import { api } from "@/lib/api";
import { Button, fieldLabel } from "@/components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const expired = new URLSearchParams(window.location.search).get("error") === "expired";
  const send = useMutation({
    mutationFn: () => api<{ ok: true; devLink?: string }>("/auth/request", { method: "POST", json: { email, origin: window.location.origin } }),
  });

  return (
    <div className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[var(--brand)] text-white lg:flex lg:items-center lg:px-14">
        <div className="absolute top-12 left-14 z-10 flex items-center gap-2.5">
          <Square className="size-5 fill-current" />
          <div className="text-[17px] font-semibold tracking-tight">Office</div>
        </div>
        <div className="relative z-10">
          <h1 className="max-w-[420px] text-[36px] leading-[1.1] font-semibold tracking-[-0.8px]">Meeting rooms<br />and requests,<br />without the chatter.</h1>
          <p className="mt-4 max-w-[380px] text-sm opacity-85">Internal tool for room bookings, office requests and messages at Office 42.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-[22px] font-semibold tracking-[-0.3px]">Sign in</h2>
          <p className="mt-1.5 text-[13.5px] text-[var(--ink-mute)]">Enter the email tied to your client account. We'll email you a one-time sign-in link — no password needed.</p>
          {expired && <p role="alert" className="mt-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]">That link has expired or was already used. Request a new one.</p>}

          {send.isSuccess ? (
            <div className="mt-6 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1 text-[var(--ink-soft)]">If {email} has an account, a sign-in link is on its way. It works once and expires in 15 minutes.</p>
              {send.data.devLink && (
                <a href={send.data.devLink} className="mt-3 inline-block text-xs font-medium text-[var(--brand)] hover:underline">Local dev only: open the sign-in link →</a>
              )}
            </div>
          ) : (
            <form className="mt-6 flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
              <div>
                <label htmlFor="login-email" className={fieldLabel}>Email</label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--ink-mute)]"><Link2 className="size-4" /></span>
                  <input id="login-email" type="email" required autoFocus placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-transparent pr-3 pl-8 text-sm outline-none focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand)]/20" />
                </div>
              </div>
              {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
              <Button type="submit" disabled={!email || send.isPending} className="w-full">{send.isPending ? "Sending…" : "Email me a sign-in link"}</Button>
              <p className="text-center text-[11.5px] text-[var(--ink-mute)]">Don't have an invite? Ask the office manager.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
