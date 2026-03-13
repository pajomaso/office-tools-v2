import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";

export function IdentityModal({
  isOpen,
  onSave,
}: {
  isOpen: boolean;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md glass-panel border border-border">
        <DialogHeader className="text-center sm:text-center space-y-4">
          {/* Sharp icon block instead of soft rounded pill */}
          <div className="mx-auto w-12 h-12 bg-foreground/5 border border-border flex items-center justify-center mb-2">
            <Building2 className="w-5 h-5 text-foreground" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-display font-bold tracking-tight text-foreground">
              The Office Engine
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Enter your name to access your workspace.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className="h-12 px-4 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            autoFocus
          />
          <Button
            type="submit"
            className="w-full h-12 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            disabled={!name.trim()}
          >
            Enter Workspace
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
