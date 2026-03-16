import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { IdentityModal } from "./IdentityModal";
import { 
  Building2, Calendar, Coffee, Wrench, Shield, Lightbulb,
  Settings, Users, Clock, LogOut, ChevronDown, Lock, Eye, EyeOff, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { userName, saveUserName, isAdmin, exitAdmin, enterAdmin } = useAppState();

  const [siteName, setSiteName] = useState("The Office Engine");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    fetch("/api/settings/site-identity")
      .then(r => r.json())
      .then(d => {
        if (d.siteName) setSiteName(d.siteName);
        if (d.logoUrl) setLogoUrl(d.logoUrl);
      })
      .catch(() => {});
  }, []);

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSetup = !!userName;

  const staffNav: any[] = [];

  const adminNav = [
    { name: "Manage Rooms", href: "/admin/rooms", icon: Calendar },
    { name: "Shopping List", href: "/admin/inventory", icon: Coffee },
    { name: "Tickets", href: "/admin/maintenance", icon: Wrench },
    { name: "Vendors", href: "/admin/vendors", icon: Users },
    { name: "Schedule", href: "/admin/scheduled", icon: Clock },
    { name: "Suggestions", href: "/suggestions", icon: Lightbulb },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  const currentNav = isAdmin ? adminNav : staffNav;

  const openPasswordDialog = () => {
    setPassword("");
    setPwError("");
    setShowPw(false);
    setShowPasswordDialog(true);
  };

  const handleAdminLogin = async () => {
    if (!password.trim()) { setPwError("Please enter the admin password."); return; }
    setLoading(true);
    setPwError("");
    const ok = await enterAdmin(password);
    setLoading(false);
    if (ok) {
      setShowPasswordDialog(false);
    } else {
      setPwError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative w-full overflow-x-hidden">
      <IdentityModal isOpen={!isSetup} onSave={saveUserName} siteName={siteName} />

      {/* Admin password dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => !open && setShowPasswordDialog(false)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Admin Access
            </DialogTitle>
            <DialogDescription>
              Enter the admin password to switch to Admin Mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Admin password"
                value={password}
                onChange={e => { setPassword(e.target.value); setPwError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                className={cn("h-12 rounded-xl pr-10", pwError && "border-destructive")}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleAdminLogin} disabled={loading} className="rounded-xl">
              {loading ? "Checking..." : "Enter Admin Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <Link href={isAdmin ? "/admin/rooms" : "/dashboard"} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-7 w-auto object-contain max-w-[120px]" />
              ) : (
                <div className="w-7 h-7 bg-foreground/8 border border-border flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-foreground" />
                </div>
              )}
              <span className="font-display font-bold text-base tracking-tight text-foreground hidden sm:block uppercase">
                {siteName}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center">
              {currentNav.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.name} href={item.href} className={cn(
                    "px-3 py-1.5 text-xs font-medium tracking-widest uppercase transition-all flex items-center gap-1.5 border-b-2 font-sans",
                    isActive
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                  )}>
                    <item.icon className="w-3.5 h-3.5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User & Mode */}
            <div className="flex items-center gap-3">
              {isSetup && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1 border border-transparent hover:border-border transition-colors focus:outline-none">
                    <div className="w-6 h-6 bg-foreground text-background flex items-center justify-center font-bold text-xs">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:flex flex-col items-start text-xs text-left leading-tight">
                      <span className="font-medium text-foreground">{userName}</span>
                      <span className="text-muted-foreground">
                        {isAdmin ? "Admin" : "Staff"}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 glass-panel border border-border">
                    <div className="p-2 px-3 flex flex-col mb-1">
                      <span className="font-medium text-sm">{userName}</span>
                      {isAdmin && (
                        <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Admin Mode
                        </span>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin ? (
                      <DropdownMenuItem
                        onClick={exitAdmin}
                        className="cursor-pointer py-2 px-3 flex items-center gap-2 text-sm"
                      >
                        <Shield className="w-4 h-4 text-muted-foreground" /> Staff Mode
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={openPasswordDialog}
                        className="cursor-pointer py-2 px-3 flex items-center gap-2 text-sm"
                      >
                        <Lock className="w-4 h-4" /> Admin Mode
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        localStorage.removeItem('officeEngineUser');
                        localStorage.removeItem('officeEngineAdmin');
                        window.location.reload();
                      }}
                      className="cursor-pointer py-2 px-3 text-destructive focus:text-destructive flex items-center gap-2 text-sm"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto hide-scrollbar border-t border-border/50 bg-background/50">
          {currentNav.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href} className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2",
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            {isSetup ? children : null}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
