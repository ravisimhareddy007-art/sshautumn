import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function ProgressModal({
  open,
  title,
  steps,
  onDone,
  onClose,
  finalToast,
}: {
  open: boolean;
  title: string;
  steps: string[];
  onDone?: () => void;
  onClose: () => void;
  finalToast?: string;
}) {
  const [completed, setCompleted] = useState(0);
  useEffect(() => {
    if (!open) {
      setCompleted(0);
      return;
    }
    if (completed >= steps.length) {
      const t = setTimeout(() => {
        onDone?.();
        onClose();
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCompleted((c) => c + 1), 450);
    return () => clearTimeout(t);
  }, [open, completed, steps.length, onDone, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ol className="space-y-2 py-2">
          {steps.map((s, i) => {
            const done = i < completed;
            const active = i === completed;
            return (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="mt-0.5">
                  {done ? (
                    <Check className="h-4 w-4 text-risk-green" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border border-border" />
                  )}
                </span>
                <span className={done ? "text-foreground" : "text-muted-foreground"}>
                  {i + 1}. {s}
                </span>
              </li>
            );
          })}
        </ol>
        {completed >= steps.length && finalToast && (
          <div className="text-[12px] text-risk-green pt-2">{finalToast}</div>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
