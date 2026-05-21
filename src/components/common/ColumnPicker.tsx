import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  mandatory?: boolean;
}

export function ColumnPicker({
  open,
  onClose,
  columns,
  selected,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  selected: string[];
  onSave: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);

  // reset draft when reopening
  useMemo(() => {
    if (open) setDraft(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = columns.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );
  const toggle = (k: string) => {
    setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  };
  const selectAll = () => setDraft(columns.map((c) => c.key));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        <div className="flex items-center justify-between mb-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-risk-orange/15 text-risk-orange font-semibold">
              {draft.length}
            </span>
            <span className="text-muted-foreground">Selected columns</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="text-primary hover:underline"
            >
              ☑ Select All
            </button>
            <button
              onClick={() => setDraft(selected)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-h-[300px] overflow-y-auto py-1">
          {filtered.map((c) => {
            const checked = draft.includes(c.key) || c.mandatory;
            return (
              <label
                key={c.key}
                className="flex items-center gap-2 text-[13px] cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  disabled={c.mandatory}
                  onCheckedChange={() => toggle(c.key)}
                />
                <span>
                  {c.label}
                  {c.mandatory && <span className="text-risk-red ml-0.5">*</span>}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const mand = columns.filter((c) => c.mandatory).map((c) => c.key);
              const next = Array.from(new Set([...mand, ...draft]));
              onSave(next);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
