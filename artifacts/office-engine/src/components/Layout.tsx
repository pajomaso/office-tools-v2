import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { IdentityModal } from "./IdentityModal";
import { 
  Building2, Calendar, Coffee, Wrench, Shield, Lightbulb,
  Settings, Users, Clock, LogOut, ChevronDown 
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

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { userName, saveUserName, isAdmin, toggleAdmin } = useAppState();

  const isSetup = !!userName;

  const staffNav = [
    { name: "Rooms", href: "/rooms", icon: Calendar },
    { name: "Inventory", href: "/inventory", icon: Coffee },
    { name: "Maintenance", href: "/maintenance", icon: Wrench },
    { name: "Suggestions", href: "/suggestions", icon: Lightbulb },
  ];

  const adminNav = [
    { name: "Manage Rooms", href: "/admin/rooms", icon: Calendar },
    { name: "Shopping List", href: "/admin/inventory", icon: Coffee },
    { name: "Tickets", href: "/admin/maintenance", icon: Wrench },
    { name: "Vendors", href: "/admin/vendors", icon: Users },
    { name: "Schedule", href: "/admin/scheduled", icon: Clock },
    { name: "Suggestions", href: "/suggestions", icon: Lightbulb },
  ];

  const currentNav = isAdmin ? adminNav : staffNav;

  return (
    <div className="min-h-screen flex flex-col relative w-full overflow-x-hidden">
      <IdentityModal isOpen={!isSetup} onSave={saveUserName} />

      {/* Decorative background element */}
      <div className="absolute top-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-foreground hidden sm:block">
                The Office Engine
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              {currentNav.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.name} href={item.href} className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 relative",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}>
                    <item.icon className="w-4 h-4" />
                    {item.name}
                    {isActive && (
                      <motion.div 
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        initial={false}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User & Settings */}
            <div className="flex items-center gap-4">
              {isSetup && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors focus:outline-none">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:flex flex-col items-start text-sm text-left">
                      <span className="font-medium text-foreground leading-none">{userName}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {isAdmin ? "Admin Mode" : "Staff Mode"}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl glass-panel">
                    <div className="p-2 px-3 flex flex-col mb-1">
                      <span className="font-medium">{userName}</span>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={toggleAdmin}
                      className="cursor-pointer py-2 px-3 rounded-lg flex items-center gap-2"
                    >
                      {isAdmin ? (
                        <><Shield className="w-4 h-4 text-muted-foreground" /> Switch to Staff Mode</>
                      ) : (
                        <><Settings className="w-4 h-4 text-primary" /> Switch to Admin Mode</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        localStorage.removeItem('officeEngineUser');
                        window.location.reload();
                      }}
                      className="cursor-pointer py-2 px-3 rounded-lg text-destructive focus:text-destructive flex items-center gap-2"
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
