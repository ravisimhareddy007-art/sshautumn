import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import type { SshKey } from "@/data/mock";
import { CAS } from "@/data/mock";
import { toast } from "sonner";

const EXTS = ["X11 forwarding", "port-forwarding", "agent-forwarding", "pty", "user-rc"];

export function ProvisionDialog({
  ssKey,
  onClose,
  onProvisioned,
}: {
  ssKey: SshKey | null;
  onClose: () => void;
  onProvisioned: (id: string) => void;
}) {
  const [ca, setCa] = useState(CAS[0].name);
  const [principals, setPrincipals] = useState("");
  const [validity, setValidity] = useState("60");
  const [exts, setExts] = useState<string[]>(["port-forwarding", "pty"]);

  if (!ssKey) return null;

  return (
    <Dialog open={!!ssKey} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Provision Key &amp; Certificate</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Key Name">
            <Input value={ssKey.name} readOnly />
          </Field>
          <Field label="Certificate Authority">
            <Select value={ca} onValueChange={setCa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAS.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Principals (comma separated)">
            <Input value={principals} onChange={(e) => setPrincipals(e.target.value)} placeholder="admin, devops" />
          </Field>
          <Field label="Max Validity">
            <Select value={validity} onValueChange={setValidity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Extensions">
            <div className="grid grid-cols-2 gap-2">
              {EXTS.map((e) => (
                <label key={e} className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={exts.includes(e)}
                    onCheckedChange={(v) =>
                      setExts((prev) => (v ? [...prev, e] : prev.filter((x) => x !== e)))
                    }
                  />
                  {e}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onProvisioned(ssKey.id);
              toast.success("Certificate provisioned successfully.");
              onClose();
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[12px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
