import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me } from "@/lib/api";
import { Button, Card, PageHeader, fieldInput, fieldLabel } from "@/components/ui";

// A real form with proper autocomplete hints, so Bitwarden and the browser offer to save the password.
export default function Account({ me }: { me: Me }) {
  const qc = useQueryClient();
  const welcome = new URLSearchParams(window.location.search).get("welcome") === "1";
  const [current, setCurrent] = useState(""), [pw, setPw] = useState(""), [again, setAgain] = useState("");
  const save = useMutation({
    mutationFn: () => api("/auth/set-password", { method: "POST", json: { password: pw, currentPassword: current } }),
    onSuccess: () => { setCurrent(""); setPw(""); setAgain(""); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  const mismatch = again !== "" && pw !== again;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={welcome ? `Welcome, ${me.name}` : "Account"} subtitle={welcome ? "You're in. You can set a password now, or keep using sign-in links." : `${me.email}${me.company ? ` · ${me.company}` : ""}`} />
      <Card className="max-w-lg p-5">
        <h2 className="text-sm font-semibold">{me.hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mt-1 text-xs text-[var(--ink-mute)]">Optional. Sign-in links keep working either way. At least 10 characters; a long phrase is best.</p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!mismatch) save.mutate(); }}>
          {/* The email is included (hidden) so password managers file the new password under the right login. */}
          <input type="email" name="username" autoComplete="username" value={me.email} readOnly hidden />
          {me.hasPassword && <div><label htmlFor="ac-cur" className={fieldLabel}>Current password</label><input id="ac-cur" name="current-password" type="password" autoComplete="current-password" className={fieldInput} value={current} onChange={(e) => setCurrent(e.target.value)} />
            <p className="mt-1 text-xs text-[var(--ink-mute)]">Not needed if you just signed in with a link.</p></div>}
          <div><label htmlFor="ac-new" className={fieldLabel}>New password</label><input id="ac-new" name="new-password" type="password" autoComplete="new-password" required minLength={10} className={fieldInput} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><label htmlFor="ac-again" className={fieldLabel}>Repeat it</label><input id="ac-again" name="new-password-confirm" type="password" autoComplete="new-password" required className={fieldInput} value={again} onChange={(e) => setAgain(e.target.value)} />
            {mismatch && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">The two don't match.</p>}</div>
          {save.isError && <p role="alert" className="text-sm text-[var(--danger)]">{save.error.message}</p>}
          {save.isSuccess && <p role="status" className="text-sm text-[var(--ok)]">Password saved. Other devices were signed out.</p>}
          <div><Button type="submit" disabled={save.isPending || mismatch || pw.length < 10}>{save.isPending ? "Saving…" : me.hasPassword ? "Change password" : "Set password"}</Button></div>
        </form>
      </Card>
    </div>
  );
}
