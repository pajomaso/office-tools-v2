import { useEffect, useState } from "react";
import { Button, Dialog } from "@/components/ui";

// In-page replacement for window.confirm (native pop-ups are blocked in some browsers and embedded views).
// Usage: `askConfirm("Delete this?").then((ok) => ok && doIt())`. <ConfirmHost /> is mounted once in the app.
let show: ((q: { message: string; resolve: (ok: boolean) => void }) => void) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => (show ? show({ message, resolve }) : resolve(window.confirm(message))));
}

export function ConfirmHost() {
  const [q, setQ] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  useEffect(() => { show = setQ; return () => { show = null; }; }, []);
  if (!q) return null;
  const done = (ok: boolean) => { q.resolve(ok); setQ(null); };
  return (
    <Dialog title="Are you sure?" description={q.message} onClose={() => done(false)}>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={() => done(false)}>Cancel</Button>
        <Button type="button" autoFocus onClick={() => done(true)}>Yes, continue</Button>
      </div>
    </Dialog>
  );
}
