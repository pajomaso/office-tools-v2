import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";

export function IdentityModal({ 
  isOpen, 
  onSave 
}: { 
  isOpen: boolean; 
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl glass-panel rounded-2xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-display text-foreground">Welcome to The Office Engine</DialogTitle>
          <DialogDescription className="text-foreground/70 pt-2">
            Please enter your name to continue. This will be used for your bookings and requests.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className="h-12 px-4 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors"
            autoFocus
          />
          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl text-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
            disabled={!name.trim()}
          >
            Enter Workspace
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
