import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Armchair, Clock, DoorOpen, Square, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import { Button, fieldInput, fieldLabel } from "@/components/ui";
import { CLOSE, OPEN } from "@/lib/time";
import clsx from "clsx";

const perks = [
  { icon: Armchair, title: "Flexible desks", body: "Book a seat for the days you come in." },
  { icon: DoorOpen, title: "Meeting rooms", body: "Reserve a room when you need one." },
  { icon: Clock, title: "Opening hours", body: `Monday to Friday, ${String(OPEN).padStart(2, "0")}:00–${CLOSE}:00.` },
  { icon: Wifi, title: "Ready to work", body: "WiFi, a community, and an office that runs itself." },
];

export default function Public() {
  const [f, setF] = useState({ name: "", email: "", company: "", interest: "desk", message: "", website: "" });
  const send = useMutation({ mutationFn: () => api("/public/leads", { method: "POST", json: f }) });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center justify-between px-6 py-5 lg:px-14">
        <div className="flex items-center gap-2 text-[var(--brand)]"><Square className="size-5 fill-current" /><span className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">Office 42</span></div>
        <Link href="/login" className="text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">Member sign in</Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-6 pb-16 lg:grid-cols-[1.1fr_1fr] lg:px-0">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Braga</p>
          <h1 className="mt-2 max-w-md text-4xl leading-[1.1] font-semibold tracking-[-0.8px]">A place to work you'll want to mention.</h1>
          <p className="mt-4 max-w-md text-[15px] text-[var(--ink-soft)]">Desks and meeting rooms in Braga, run by Subvisual. Tell us what you're looking for — no commitment, we'll get back to you.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {perks.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)]"><Icon className="size-4" /></span>
                <div className="mt-3 text-sm font-semibold">{title}</div>
                <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-[var(--ink-mute)]">Plans and pricing: get in touch and we'll walk you through the options.</p>
        </section>
        <section className="rounded-[var(--r-xl)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] self-start">
          {send.isSuccess ? (
            <div role="status"><h2 className="text-lg font-semibold">Thanks, {f.name.split(" ")[0]}.</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">We got your message and will reply to {f.email} soon.</p></div>
          ) : (
            <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
              <h2 className="text-lg font-semibold tracking-tight">I'm interested</h2>
              <div><label className={fieldLabel} htmlFor="ld-name">Name</label><input id="ld-name" required maxLength={120} className={fieldInput} value={f.name} onChange={set("name")} /></div>
              <div><label className={fieldLabel} htmlFor="ld-email">Email</label><input id="ld-email" type="email" required className={fieldInput} value={f.email} onChange={set("email")} /></div>
              <div><label className={fieldLabel} htmlFor="ld-company">Company (optional)</label><input id="ld-company" maxLength={160} className={fieldInput} value={f.company} onChange={set("company")} /></div>
              <div><label className={fieldLabel} htmlFor="ld-int">I'm looking for</label>
                <select id="ld-int" className={fieldInput} value={f.interest} onChange={set("interest")}><option value="desk">A desk</option><option value="room">A meeting room</option><option value="other">Something else</option></select></div>
              <div><label className={fieldLabel} htmlFor="ld-msg">Anything we should know? (optional)</label><textarea id="ld-msg" rows={3} maxLength={1000} className={clsx(fieldInput, "h-auto py-2")} value={f.message} onChange={set("message")} /></div>
              {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
              <div aria-hidden="true" className="absolute -left-[9999px]"><label htmlFor="ld-web">Website</label><input id="ld-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></div>
              {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
              <Button type="submit" disabled={send.isPending}>{send.isPending ? "Sending…" : "Send"}</Button>
              <p className="text-center text-[11.5px] text-[var(--ink-mute)]">We only use your details to reply to you.</p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
