import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormRow, FormSection } from "@/components/pgp/pgp-form";
import { saveSettings, usePgp } from "@/lib/pgp-store";
import { fmtDate } from "@/data/pgp";

export const Route = createFileRoute("/_app/administration/pgp")({
  component: PgpSettingsPage,
});

function PgpSettingsPage() {
  const s = usePgp();
  const [keyserver, setKeyserver] = useState(s.settings.keyserver);
  const [wkd, setWkd] = useState(s.settings.wkdDomain);
  const [tested, setTested] = useState<string | null>(null);
  useEffect(() => {
    setKeyserver(s.settings.keyserver);
    setWkd(s.settings.wkdDomain);
  }, [s.settings]);

  const ksError =
    keyserver && !/^(hkps?:\/\/|https:\/\/)[\w.-]+(:\d+)?\/?$/.test(keyserver.trim())
      ? "Use an hkps://, hkp:// or https:// address, for example hkps://keys.openpgp.org"
      : undefined;
  const dirty = keyserver !== s.settings.keyserver || wkd !== s.settings.wkdDomain;

  return (
    <div className="max-w-5xl">
      <PageHeader breadcrumbs={["ADMINISTRATION", "PGP Settings"]} title="PGP Settings" />
      <div className="bg-surface border border-border rounded-md p-6">
        <FormSection title="Publishing">
          <FormRow
            label="Keyserver address"
            error={ksError}
            hint="Used by Publish, by Import Key from a keyserver and by the Publish option in Provision PGP Key. Leave blank to turn publishing off."
          >
            <div className="flex gap-2 max-w-xl">
              <Input
                value={keyserver}
                onChange={(e) => (setKeyserver(e.target.value), setTested(null))}
                placeholder="hkps://keys.openpgp.org"
              />
              <Button
                variant="outline"
                disabled={!keyserver || !!ksError}
                onClick={() => {
                  setTested(keyserver);
                  toast.success(`Connected to ${keyserver}`);
                }}
              >
                Test connection
              </Button>
            </div>
            {tested === keyserver && keyserver && (
              <div className="text-[11px] text-[#15803D] mt-1">Reachable</div>
            )}
          </FormRow>
          <FormRow
            label="Web Key Directory domain"
            hint="Domain used in the files produced by Export for WKD."
          >
            <Input value={wkd} onChange={(e) => setWkd(e.target.value)} className="max-w-md" />
          </FormRow>
        </FormSection>

        <FormSection title="Recent PGP activity">
          {s.audit.length === 0 ? (
            <div className="text-[12px] text-muted-foreground py-2">
              No PGP actions in this session yet.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Key</th>
                  <th className="py-1 font-medium">Action</th>
                  <th className="py-1 font-medium">Outcome</th>
                  <th className="py-1 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {s.audit.slice(0, 20).map((a, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5">{fmtDate(a.at)}</td>
                    <td className="py-1.5">{a.keyName}</td>
                    <td className="py-1.5">
                      {a.action}
                      {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
                    </td>
                    <td className="py-1.5">{a.outcome}</td>
                    <td className="py-1.5">{a.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </FormSection>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            disabled={!dirty}
            onClick={() => {
              setKeyserver(s.settings.keyserver);
              setWkd(s.settings.wkdDomain);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!dirty || !!ksError}
            onClick={() => {
              saveSettings({ keyserver: keyserver.trim(), wkdDomain: wkd.trim() });
              toast.success("PGP settings saved");
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
