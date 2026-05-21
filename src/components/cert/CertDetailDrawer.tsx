import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { USER_KEYS, HOST_KEYS, type SshCert } from "@/data/mock";
import { cn } from "@/lib/utils";

const statusVariant = (s: SshCert["status"]) =>
  s === "Active"
    ? "bg-risk-green/15 text-risk-green border-risk-green/30"
    : s === "Expired"
      ? "bg-risk-red/15 text-risk-red border-risk-red/30"
      : "bg-muted text-muted-foreground border-border";

export function CertDetailDrawer({
  cert,
  onClose,
  onRevoke,
  onRotate,
}: {
  cert: SshCert | null;
  onClose: () => void;
  onRevoke?: (c: SshCert) => void;
  onRotate?: (c: SshCert) => void;
}) {
  const key =
    cert &&
    (cert.type === "user"
      ? USER_KEYS.find((k) => k.id === cert.associatedKeyId)
      : HOST_KEYS.find((k) => k.id === cert.associatedKeyId));

  return (
    <Sheet open={!!cert} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 overflow-y-auto">
        {cert && (
          <>
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-[16px]">{cert.certKeyId}</SheetTitle>
                  <div className="text-[12px] text-muted-foreground">{cert.certName}</div>
                </div>
                <Badge variant="outline" className={cn("border", statusVariant(cert.status))}>
                  {cert.status}
                </Badge>
              </div>
              <div className="flex gap-2 mt-3">
                {cert.status === "Active" && (
                  <>
                    <Button size="sm" onClick={() => onRotate?.(cert)}>
                      Rotate Certificate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onRevoke?.(cert)}>
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </SheetHeader>

            <Section title="Certificate Details">
              <Row label="CA / Issuer" value={cert.caName} />
              <Row label="Serial Number" value={cert.serialNumber} mono />
              <Row label="Valid From" value={cert.validFrom} />
              <Row
                label="Valid To"
                value={
                  <span
                    className={cn(
                      cert.expiresInDays <= 0
                        ? "text-risk-red"
                        : cert.expiresInDays <= 30
                          ? "text-risk-amber"
                          : "text-foreground",
                    )}
                  >
                    {cert.validTo}
                  </span>
                }
              />
              <Row label="Expires In" value={cert.expiresIn} />
              <Row
                label="Principals"
                value={
                  <div className="flex flex-wrap gap-1">
                    {cert.principals.length === 0 && <span className="text-muted-foreground">—</span>}
                    {cert.principals.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[11px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <Row
                label="Extensions"
                value={
                  <div className="flex flex-wrap gap-1">
                    {cert.extensions.length === 0 && <span className="text-muted-foreground">—</span>}
                    {cert.extensions.map((e) => (
                      <Badge
                        key={e}
                        variant="outline"
                        className="text-[11px] bg-risk-green/10 text-risk-green border-risk-green/30"
                      >
                        {e}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <Row label="Cert Type" value={cert.type === "user" ? "User" : "Host"} />
              <Row
                label="Compliance Status"
                value={
                  <Badge
                    variant="outline"
                    className={cn(
                      cert.complianceStatus === "Compliant"
                        ? "bg-risk-green/15 text-risk-green border-risk-green/30"
                        : "bg-risk-red/15 text-risk-red border-risk-red/30",
                    )}
                  >
                    {cert.complianceStatus}
                  </Badge>
                }
              />
            </Section>

            <Section title="Associated Key">
              {key ? (
                <>
                  <Row
                    label="Key Name"
                    value={
                      <Link
                        to={key.type === "user" ? "/inventory/keys/user" : "/inventory/keys/host"}
                        search={{ highlight: key.id }}
                        className="text-primary hover:underline font-medium"
                        onClick={onClose}
                      >
                        {key.name}
                      </Link>
                    }
                  />
                  <Row label="Encryption" value={key.encryption} />
                  <Row label="Length" value={String(key.length)} />
                  <Row label="Key Age" value={key.age} />
                  <Row
                    label="Key Status"
                    value={
                      <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                        {key.status}
                      </Badge>
                    }
                  />
                </>
              ) : (
                <div className="text-muted-foreground text-[12px]">Key not found</div>
              )}
            </Section>

            <Section title="Deployed Endpoints">
              <ul className="space-y-2">
                {cert.endpoints.map((e) => (
                  <li key={e} className="flex items-center justify-between text-[13px]">
                    <span className="font-mono">{e}</span>
                    <Badge variant="outline" className="bg-risk-green/15 text-risk-green border-risk-green/30">
                      ✓ Active
                    </Badge>
                  </li>
                ))}
                {cert.endpoints.length === 0 && (
                  <li className="text-muted-foreground text-[12px]">No endpoints</li>
                )}
              </ul>
            </Section>

            <Section title="Audit History" defaultOpen={false}>
              <ul className="border-l-2 border-border pl-4 space-y-3 text-[12px]">
                <li>
                  <div className="font-medium">Provisioned</div>
                  <div className="text-muted-foreground">{cert.validFrom} by admin@appviewx.com</div>
                </li>
                <li>
                  <div className="font-medium">Status checked</div>
                  <div className="text-muted-foreground">2026-05-14 by system</div>
                </li>
              </ul>
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="border-b border-border">
      <summary className="px-5 py-3 text-[12px] uppercase-tracking font-semibold text-muted-foreground cursor-pointer hover:bg-muted/50">
        {title}
      </summary>
      <div className="px-5 pb-4 space-y-2">{children}</div>
    </details>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-[13px] items-start">
      <div className="text-muted-foreground">{label}</div>
      <div className={cn(mono && "font-mono break-all")}>{value}</div>
    </div>
  );
}
