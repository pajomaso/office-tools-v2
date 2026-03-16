import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ShieldCheck, BookOpen, Phone, Save, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSettings() {
  const { toast } = useToast();

  // ── Admin password ──────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  const handleChangePw = async () => {
    setPwError("");
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields are required."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords don't match."); return; }
    if (newPw.trim().length < 4) { setPwError("New password must be at least 4 characters."); return; }
    setPwLoading(true);
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
        setPwError(data.error || "Failed to update password.");
      }
    } catch { setPwError("Network error. Please try again."); }
    finally { setPwLoading(false); }
  };

  // ── Site identity ──────────────────────────────────────────────────────
  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/site-identity")
      .then(r => r.json())
      .then(d => { setSiteName(d.siteName ?? ""); setLogoUrl(d.logoUrl ?? ""); })
      .catch(() => {});
  }, []);

  const handleSaveIdentity = async () => {
    setIdentityLoading(true);
    try {
      const res = await fetch("/api/settings/site-identity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName, logoUrl }),
      });
      if (res.ok) {
        toast({ title: "Identity updated", description: "Site name and logo saved." });
        setIdentitySaved(true);
        setTimeout(() => setIdentitySaved(false), 2000);
      } else {
        toast({ variant: "destructive", title: "Failed to save" });
      }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setIdentityLoading(false); }
  };

  // ── Office info ─────────────────────────────────────────────────────────
  const [instructions, setInstructions] = useState("");
  const [instructionsVideo, setInstructionsVideo] = useState("");
  const [contacts, setContacts] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/office-info")
      .then(r => r.json())
      .then(d => {
        setInstructions(d.instructions ?? "");
        setInstructionsVideo(d.instructionsVideo ?? "");
        setContacts(d.contacts ?? "");
      })
      .catch(() => {});
  }, []);

  const handleSaveInfo = async () => {
    setInfoLoading(true);
    try {
      const res = await fetch("/api/settings/office-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, instructionsVideo, contacts }),
      });
      if (res.ok) {
        toast({ title: "Info updated", description: "Office information saved successfully." });
        setInfoSaved(true);
        setTimeout(() => setInfoSaved(false), 2000);
      } else {
        toast({ variant: "destructive", title: "Failed to save" });
      }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setInfoLoading(false); }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage admin access and office information.</p>
      </div>

      {/* ── ADMIN PASSWORD ─────────────────────────────────────────────── */}
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
              <Input type={showCurrent ? "text" : "password"} placeholder="••••••••" value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setPwError(""); }} className="h-12 rounded-xl pr-10" />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <Input type={showNew ? "text" : "password"} placeholder="••••••••" value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(""); }} className="h-12 rounded-xl pr-10" />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input type="password" placeholder="••••••••" value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwError(""); }}
              onKeyDown={e => e.key === "Enter" && handleChangePw()}
              className={cn("h-12 rounded-xl", pwError && "border-destructive")} />
          </div>
          {pwError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-xl">
              <Lock className="w-4 h-4 shrink-0" /> {pwError}
            </div>
          )}
          <Button onClick={handleChangePw} disabled={pwLoading} className="w-full h-12 rounded-xl">
            {pwLoading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </Card>

      {/* ── SITE IDENTITY ─────────────────────────────────────────────────── */}
      <Card className="p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Palette className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Site Identity</h2>
            <p className="text-sm text-muted-foreground">Customize the name and logo shown to all users.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Site Name</label>
            <Input
              placeholder="The Office Engine"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              className="h-12 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Displayed in the header and on the welcome screen.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo URL <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              className="h-12 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Paste a direct image URL. Leave blank to use the default icon.</p>
          </div>
          {logoUrl && (
            <div className="p-4 rounded-xl bg-muted flex items-center gap-3">
              <img src={logoUrl} alt="Logo preview" className="h-8 w-auto object-contain max-w-[100px]" onError={e => (e.currentTarget.style.display = "none")} />
              <span className="text-sm text-muted-foreground">Logo preview</span>
            </div>
          )}
          <Button
            onClick={handleSaveIdentity}
            disabled={identityLoading}
            className={cn("h-11 rounded-xl px-6 gap-2", identitySaved && "bg-green-600 hover:bg-green-600")}
          >
            <Save className="w-4 h-4" />
            {identityLoading ? "Saving..." : identitySaved ? "Saved!" : "Save Identity"}
          </Button>
        </div>
      </Card>

      {/* ── OFFICE INFO EDITOR ────────────────────────────────────────────── */}
      <Card className="p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Office Information</h2>
            <p className="text-sm text-muted-foreground">Edit the Instructions and Contacts shown to staff.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Useful Contacts
            </label>
            <Textarea
              placeholder={"Paulo Sousa - 916 632 542\nJane Smith - 912 345 678"}
              value={contacts}
              onChange={e => setContacts(e.target.value)}
              className="rounded-xl resize-none font-mono text-sm"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">One contact per line. Plain text.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" /> Instructions Text
            </label>
            <Textarea
              placeholder={"## Alarm & Access\n\nStep 1: ...\nStep 2: ..."}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="rounded-xl resize-none font-mono text-sm"
              rows={10}
            />
            <p className="text-xs text-muted-foreground">Supports plain text. Use line breaks for structure.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Video Guide URL <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              placeholder="https://drive.google.com/file/d/..."
              value={instructionsVideo}
              onChange={e => setInstructionsVideo(e.target.value)}
              className="h-11 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Paste a Google Drive or YouTube link — staff will see a "Watch video guide" button.</p>
          </div>

          <Button
            onClick={handleSaveInfo}
            disabled={infoLoading}
            className={cn("h-11 rounded-xl px-6 gap-2", infoSaved && "bg-green-600 hover:bg-green-600")}
          >
            <Save className="w-4 h-4" />
            {infoLoading ? "Saving..." : infoSaved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
