import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSettings() {
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async () => {
    setError("");
    if (!currentPw || !newPw || !confirmPw) {
      setError("All fields are required."); return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords don't match."); return;
    }
    if (newPw.trim().length < 4) {
      setError("New password must be at least 4 characters."); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/settings/admin-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        toast({ title: "Password updated", description: "The new admin password is now active." });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update password.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage admin access and system preferences.</p>
      </div>

      <Card className="p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Admin Password</h2>
            <p className="text-sm text-muted-foreground">Change the password required to enter Admin Mode.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                placeholder="••••••••"
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setError(""); }}
                className="h-12 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder="••••••••"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setError(""); }}
                className="h-12 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleChange()}
              className={cn("h-12 rounded-xl", error && "border-destructive")}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-xl">
              <Lock className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <Button
            onClick={handleChange}
            disabled={loading}
            className="w-full h-12 rounded-xl"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
