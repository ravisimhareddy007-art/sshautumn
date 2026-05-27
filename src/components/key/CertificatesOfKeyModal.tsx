import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo, useState } from "react";
import type { SshKey, SshCert } from "@/data/mock";
import { USER_CERTS, HOST_CERTS } from "@/data/mock";
import { RevokeCertDialog } from "@/components/cert/RevokeCertDialog";
import { RotateCertDialog } from "@/components/cert/RotateCertDialog";
import { DeleteCertDialog } from "@/components/cert/DeleteCertDialog";
import { certRotateAction, certRevokeAction, certDeleteAction } from "@/lib/clm-actions";
import { cn } from "@/lib/utils";
import { RefreshCw, Search, RotateCcw, ShieldOff, Trash2 } from "lucide-react";

export function CertificatesOfKeyModal({
  ssKey,
  onClose,
  onSelectCert,
}: {
  ssKey: SshKey | null;
  onClose: () => void;
  onSelectCert: (c: SshCert) => void;
}) {
  const [search, setSearch] = useState("");
  const [localCerts, setLocalCerts] = useState<SshCert[] | null>(null);
  const [revokeCert, setRevokeCert] = useState<SshCert | null>(null);
  const [rotateCert, setRotateCert] = useState<SshCert | null>(null);
  const [deleteCert, setDeleteCert] = useState<SshCert | null>(null);

  const baseCerts = useMemo<SshCert[]>(() => {
    if (!ssKey) return [];
    const pool = ssKey.type === "user" ? USER_CERTS : HOST_CERTS;
    return pool.filter((c) => c.associatedKeyId === ssKey.id);
  }, [ssKey]);

  const certs = localCerts ?? baseCerts;

  const filtered = certs.filter(
    (c) =>
      c.certKeyId.toLowerCase().includes(search.toLowerCase()) ||
      c.certName.toLowerCase().includes(search.toLowerCase()),
  );

  const updateCert = (id: string, patch: Partial<SshCert>) => {
    setLocalCerts((prev) => (prev ?? baseCerts).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCert = (id: string) => {
    setLocalCerts((prev) => (prev ?? baseCerts).filter((c) => c.id !== id));
  };

  const keyCombination = ssKey?.combination ?? "private_public";

  return (
    <>
      <Dialog open={!!ssKey} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-[1000px]">
          <DialogHeader>
            <DialogTitle>Certificates of Key &quot;{ssKey?.name}&quot;</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-7 h-8 text-[13px]"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span>1 to {filtered.length} of {filtered.length}</span>
              <button className="p-1 hover:bg-muted rounded">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/60 text-[11px] uppercase-tracking text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Principals</th>
                  <th className="text-left px-3 py-2">CA Name</th>
                  <th className="text-left px-3 py-2">Serial Number</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Valid From</th>
                  <th className="text-left px-3 py-2">Valid To</th>
                  <th className="text-left px-3 py-2">Expires In</th>
                  <th className="text-left px-3 py-2">Extensions</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const rotateA = certRotateAction(c.status, keyCombination);
                  const revokeA = certRevokeAction(c.status);
                  const deleteA = certDeleteAction(c.status);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCert(c)}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-3 py-2">{c.principals.join(", ") || "--"}</td>
                      <td className="px-3 py-2">{c.caName}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{c.serialNumber}…</td>
                      <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                      <td className="px-3 py-2">{c.validFrom}</td>
                      <td className={cn("px-3 py-2", c.expiresInDays <= 0 ? "text-risk-red" : c.expiresInDays <= 30 ? "text-risk-amber" : "")}>
                        {c.validTo}
                      </td>
                      <td className="px-3 py-2">{c.expiresIn}</td>
                      <td className="px-3 py-2">
                        {c.extensions[0] && (
                          <Badge variant="outline" className="bg-risk-green/10 text-risk-green border-risk-green/30 mr-1">
                            {c.extensions[0]}
                          </Badge>
                        )}
                        {c.extensions.length > 1 && (
                          <Badge variant="outline" title={c.extensions.join(", ")}>
                            +{c.extensions.length - 1} more
                          </Badge>
                        )}
                      </td>

                      {/* Actions column */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">

                          {/* Rotate */}
                          {rotateA.show && (
                            rotateA.enabled ? (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Rotate Certificate" onClick={() => setRotateCert(c)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-35 cursor-not-allowed" disabled>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">{rotateA.tooltip}</TooltipContent>
                              </Tooltip>
                            )
                          )}

                          {/* Revoke */}
                          {revokeA.show && (
                            revokeA.enabled ? (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-risk-red" title="Revoke Certificate" onClick={() => setRevokeCert(c)}>
                                <ShieldOff className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-35 cursor-not-allowed" disabled>
                                    <ShieldOff className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">{revokeA.tooltip}</TooltipContent>
                              </Tooltip>
                            )
                          )}

                          {/* Delete */}
                          {deleteA.show && (
                            deleteA.enabled ? (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-risk-red" title="Delete Certificate" onClick={() => setDeleteCert(c)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-35 cursor-not-allowed" disabled>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">{deleteA.tooltip}</TooltipContent>
                              </Tooltip>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                      No certificates found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <RotateCertDialog
        cert={rotateCert}
        onClose={() => setRotateCert(null)}
        onRotated={(c) => updateCert(c.id, { validTo: "2026-08-20", expiresIn: "90 days", expiresInDays: 90 })}
      />
      <RevokeCertDialog
        cert={revokeCert}
        onClose={() => setRevokeCert(null)}
        onRevoked={(c) => updateCert(c.id, { status: "Revoked" })}
      />
      <DeleteCertDialog
        cert={deleteCert}
        onClose={() => setDeleteCert(null)}
        onDeleted={(c) => removeCert(c.id)}
      />
    </>
  );
}

function StatusBadge({ status }: { status: SshCert["status"] }) {
  const cls =
    status === "Active"
      ? "bg-risk-green/15 text-risk-green border-risk-green/30"
      : status === "Expired"
        ? "bg-risk-red/15 text-risk-red border-risk-red/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}