import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormRow, FormSection, Toggle } from "@/components/pgp/pgp-form";
import { saveDiscovery, usePgp } from "@/lib/pgp-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/discovery/profiles")({
  component: DiscoveryProfilesPage,
});

interface Profile {
  id: string;
  name: string;
  hostGroup: string;
  sshKeys: boolean;
  sshCerts: boolean;
  pgp: boolean;
  lastRun: string;
}

const SEED: Profile[] = [
  {
    id: "p1",
    name: "Default_Discovery_Profile",
    hostGroup: "Default_Host_Group",
    sshKeys: true,
    sshCerts: true,
    pgp: true,
    lastRun: "Today, 06:10",
  },
  {
    id: "p2",
    name: "Prod_Linux_Weekly",
    hostGroup: "Prod_Group",
    sshKeys: true,
    sshCerts: true,
    pgp: false,
    lastRun: "3 days ago",
  },
];

function DiscoveryProfilesPage() {
  const s = usePgp();
  const [profiles, setProfiles] = useState<Profile[]>(SEED);
  const [selId, setSelId] = useState("p1");
  const sel = profiles.find((p) => p.id === selId)!;
  const [draft, setDraft] = useState<Profile>(sel);
  const [paths, setPaths] = useState<string[]>(s.discovery.paths);
  const [newPath, setNewPath] = useState("");

  const pick = (id: string) => {
    setSelId(id);
    setDraft(profiles.find((p) => p.id === id)!);
  };
  const addPath = () => {
    const v = newPath.trim();
    if (!v || paths.includes(v)) return;
    setPaths((p) => [...p, v]);
    setNewPath("");
  };

  return (
    <div>
      <PageHeader breadcrumbs={["DISCOVERY", "Discovery Profiles"]} title="Discovery Profiles" />
      <div className="grid grid-cols-[320px_1fr] gap-4">
        <div className="bg-surface border border-border rounded-md overflow-hidden self-start">
          <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            Profiles
          </div>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-border last:border-0",
                p.id === selId ? "bg-row-selected" : "hover:bg-muted/60",
              )}
            >
              <div className="text-[13px] font-medium">{p.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {p.hostGroup} ·{" "}
                {[p.sshKeys && "SSH keys", p.sshCerts && "SSH certificates", p.pgp && "PGP keys"]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              <div className="text-[11px] text-muted-foreground">Last run {p.lastRun}</div>
            </button>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-md p-6">
          <FormSection title="Profile">
            <FormRow label="Name" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="max-w-md"
              />
            </FormRow>
            <FormRow label="Host group">
              <Input value={draft.hostGroup} readOnly className="max-w-md bg-muted/40" />
            </FormRow>
          </FormSection>
          <FormSection title="What to discover">
            <FormRow label="SSH keys">
              <Toggle
                checked={draft.sshKeys}
                onChange={(v) => setDraft({ ...draft, sshKeys: v })}
                label="SSH keys"
              />
            </FormRow>
            <FormRow label="SSH certificates">
              <Toggle
                checked={draft.sshCerts}
                onChange={(v) => setDraft({ ...draft, sshCerts: v })}
                label="SSH certificates"
              />
            </FormRow>
            <FormRow
              label="Discover PGP keys"
              hint="Finds own keys (with a private key) and trusted keys (public only) in GnuPG keyrings, key files and package manager keyrings. The first run on a host sets its PGP baseline for the Rogue risk."
            >
              <div className="flex items-center gap-2">
                <Toggle
                  checked={draft.pgp}
                  onChange={(v) => setDraft({ ...draft, pgp: v })}
                  label="Discover PGP keys"
                />
                <Badge className="text-[9px] bg-primary text-white px-1.5">NEW</Badge>
              </div>
            </FormRow>
            {draft.pgp && (
              <FormRow
                label="PGP Key Paths"
                hint="Every OS user's GnuPG home is always scanned. Add other folders or files where keys are kept. Wildcards are allowed."
              >
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap gap-1.5">
                    {paths.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[11px]"
                      >
                        {p}
                        <button
                          onClick={() => setPaths((x) => x.filter((y) => y !== p))}
                          aria-label={`Remove ${p}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newPath}
                      onChange={(e) => setNewPath(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPath()}
                      placeholder="/srv/transfer/keys"
                      className="h-8 font-mono text-[12px]"
                    />
                    <Button variant="outline" size="sm" onClick={addPath}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add path
                    </Button>
                  </div>
                </div>
              </FormRow>
            )}
          </FormSection>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => (setDraft(sel), setPaths(s.discovery.paths))}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setProfiles((x) => x.map((p) => (p.id === draft.id ? draft : p)));
                saveDiscovery({ enabled: draft.pgp, paths });
                toast.success(`Discovery profile "${draft.name}" saved`);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
