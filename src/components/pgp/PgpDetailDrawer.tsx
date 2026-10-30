import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Copy, KeyRound, RotateCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  fmtDate,
  groupedFp,
  keyIdOf,
  shortFp,
  type OwnKey,
  type PgpKey,
  type PgpLocation,
  type Subkey,
  type TrustedKey,
} from "@/data/pgp";
import { algoLabel, RISK_HELP, subkeyStatus } from "@/lib/pgp-rules";
import { keyName, retryFailed, usePgp } from "@/lib/pgp-store";
import {
  ComplianceCell,
  derive,
  KV,
  NextExpiryCell,
  Pill,
  PurposeList,
  Section,
  StatusBadge,
} from "./pgp-ui";
import { cn } from "@/lib/utils";

export function PgpDetailDrawer({ keyId, onClose }: { keyId: string | null; onClose: () => void }) {
  const s = usePgp();
  const k: PgpKey | undefined =
    s.own.find((x) => x.id === keyId) ?? s.trusted.find((x) => x.id === keyId);
  return (
    <Sheet open={!!keyId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[640px] p-0 overflow-y-auto">
        {k && <Body k={k} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ k }: { k: PgpKey }) {
  const s = usePgp();
  const d = derive(k, s.policies);
  const copy = () => {
    navigator.clipboard?.writeText(k.primary.fingerprint).catch(() => undefined);
    toast.success("Fingerprint copied");
  };
  return (
    <div>
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <KeyRound className="h-4 w-4 text-primary" />
          <SheetTitle className="text-[16px]">{keyName(k)}</SheetTitle>
          <StatusBadge status={d.status} />
          {k.kind === "own" ? <Pill>{k.management}</Pill> : <Pill>{k.type} key</Pill>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-[12px] font-mono text-muted-foreground">
            {groupedFp(k.primary.fingerprint)}
          </code>
          <button onClick={copy} className="p-1 rounded hover:bg-muted" title="Copy fingerprint">
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </SheetHeader>

      <div className="px-5 py-4">
        <Section title="Summary">
          <div className="grid grid-cols-3 gap-4">
            <KV
              label="Key ID"
              value={<span className="font-mono">{keyIdOf(k.primary.fingerprint)}</span>}
            />
            <KV label="Algorithm" value={algoLabel(k.primary.algo)} />
            <KV label="Created" value={fmtDate(k.primary.created)} />
            <KV label="Next Expiry" value={<NextExpiryCell k={k} status={d.status} />} />
            <KV label="Purpose" value={<PurposeList list={d.purposes} />} />
            <KV label="Key Group" value={`${k.group} (${d.policy.name})`} />
            {k.kind === "own" ? (
              <>
                <KV label="Storage" value={k.storage === "Host only" ? "Hosts only" : k.storage} />
                <KV
                  label="Compliance"
                  value={d.compliance && <ComplianceCell c={d.compliance} />}
                />
                <KV label="Passphrase" value={k.passphrase} />
              </>
            ) : (
              <>
                <KV
                  label="Approval"
                  value={k.type === "Repository" ? "Set by policy" : k.approval}
                />
                <KV label="Source" value={k.source} />
                {k.repoManager && <KV label="Package manager" value={k.repoManager} />}
              </>
            )}
          </div>
        </Section>

        <Section title="Risks">
          {d.risks.length === 0 ? (
            <div className="text-[13px] text-muted-foreground">No risks found.</div>
          ) : (
            <ul className="space-y-1.5">
              {d.risks.map((r) => (
                <li key={r} className="flex gap-2 text-[13px]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-risk-amber shrink-0" />
                  <span>
                    <span className="font-medium">{r}.</span> {RISK_HELP[r]}
                    {k.kind === "own" && d.policy.allowedRisks.includes(r) && (
                      <span className="text-muted-foreground"> Allowed by policy.</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {d.compliance?.state === "Non-Compliant" && (
            <div className="mt-3 rounded border border-risk-red/30 bg-risk-red/5 px-3 py-2 text-[13px]">
              <div className="font-medium text-risk-red mb-1">Why it is non-compliant</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {d.compliance.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {k.kind === "trusted" && <ApprovalSection k={k} />}

        <Section title="User IDs">
          <table className="w-full text-[13px]">
            <tbody>
              {k.userIds.map((u, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className={cn(u.revoked && "line-through text-muted-foreground")}>
                      {u.name}
                      {u.comment && <span className="text-muted-foreground"> ({u.comment})</span>}
                      {u.email && <span className="text-muted-foreground"> &lt;{u.email}&gt;</span>}
                    </span>
                  </td>
                  <td className="py-1.5 text-right space-x-1">
                    {u.primary && <Pill>Primary</Pill>}
                    {u.revoked && (
                      <Pill className="text-risk-red border-risk-red/30">
                        Revoked {fmtDate(u.revoked.at)}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Primary key and subkeys">
          <SubkeyTable k={k} threshold={d.policy.expiringThreshold} keyStatus={d.status} />
        </Section>

        {k.kind === "own" ? (
          <OwnLocations k={k} />
        ) : (
          <Locations
            title="Hosts"
            list={k.locations}
            empty="Not on any host yet. Use Distribute to place it."
          />
        )}

        {k.kind === "own" && <OwnExtras k={k} />}

        <Section title="History">
          {k.history.length === 0 ? (
            <div className="text-[13px] text-muted-foreground">
              No operations yet. Found by discovery{" "}
              {k.lastDiscovered ? fmtDate(k.lastDiscovered) : ""}.
            </div>
          ) : (
            <ul className="space-y-1">
              {[...k.history].reverse().map((o, i) => (
                <li key={i} className="flex gap-2 text-[13px]">
                  <span className="w-[92px] shrink-0 text-muted-foreground">{fmtDate(o.at)}</span>
                  <span className="font-medium">{o.action}</span>
                  <span className="text-muted-foreground">by {o.user}</span>
                  {o.outcome !== "Succeeded" && (
                    <span className={o.outcome === "Failed" ? "text-risk-red" : "text-[#B45309]"}>
                      {o.outcome}
                    </span>
                  )}
                  {o.detail && <span className="text-muted-foreground truncate">· {o.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function SubkeyTable({
  k,
  threshold,
  keyStatus,
}: {
  k: PgpKey;
  threshold: number;
  keyStatus: string;
}) {
  const rows: {
    type: string;
    purpose: string;
    algo: string;
    created: string;
    expires: string | null;
    status: string;
    fp: string;
    note?: string;
  }[] = [
    {
      type: "Primary",
      purpose: k.primary.canSign ? "Certify, Sign" : "Certify",
      algo: algoLabel(k.primary.algo),
      created: k.primary.created,
      expires: k.primary.expires,
      status: keyStatus,
      fp: k.primary.fingerprint,
      note: k.primary.revoked
        ? `${k.primary.revoked.reason}${k.primary.revoked.comment ? `: ${k.primary.revoked.comment}` : ""}`
        : undefined,
    },
    ...k.subkeys.map((sk: Subkey) => ({
      type: "Subkey",
      purpose: sk.purpose,
      algo: algoLabel(sk.algo),
      created: sk.created,
      expires: sk.expires,
      status: subkeyStatus(sk, threshold),
      fp: sk.fingerprint,
      note:
        sk.retiredBy === "rotate"
          ? "Replaced by Rotate Subkey"
          : sk.retiredBy === "retire"
            ? "Ended by Retire"
            : sk.revoked
              ? sk.revoked.reason
              : undefined,
    })),
  ];
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className="py-1 font-medium">Type</th>
          <th className="py-1 font-medium">Purpose</th>
          <th className="py-1 font-medium">Algorithm</th>
          <th className="py-1 font-medium">Expires</th>
          <th className="py-1 font-medium">Status</th>
          <th className="py-1 font-medium">Fingerprint</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.fp} className="border-t border-border align-top">
            <td className="py-1.5">{r.type}</td>
            <td className="py-1.5">{r.purpose}</td>
            <td className="py-1.5">{r.algo}</td>
            <td className="py-1.5">{r.expires ? fmtDate(r.expires) : "No expiry"}</td>
            <td className="py-1.5">
              {r.status ? (
                <StatusBadge status={r.status as never} />
              ) : (
                <span className="text-muted-foreground">Key status</span>
              )}
              {r.note && <div className="text-[12px] text-muted-foreground mt-0.5">{r.note}</div>}
            </td>
            <td className="py-1.5 font-mono text-[12px]" title={r.fp}>
              {shortFp(r.fp)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Locations({
  title,
  list,
  empty,
  right,
}: {
  title: string;
  list: PgpLocation[];
  empty: string;
  right?: React.ReactNode;
}) {
  const shown = list.slice(0, 12);
  return (
    <Section title={`${title} (${list.length})`} right={right}>
      {list.length === 0 ? (
        <div className="text-[13px] text-muted-foreground">{empty}</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1 font-medium">Host</th>
              <th className="py-1 font-medium">OS user</th>
              <th className="py-1 font-medium">Path</th>
              <th className="py-1 font-medium">Held in</th>
              <th className="py-1 font-medium">Placed by</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={i} className="border-t border-border align-top">
                <td className="py-1.5">{l.host}</td>
                <td className="py-1.5">{l.osUser}</td>
                <td className="py-1.5 font-mono text-[12px] break-all">
                  {l.path}
                  {l.misplaced && (
                    <div className="text-risk-red font-sans text-[12px]">
                      Misplaced: {l.misplaced}
                    </div>
                  )}
                  {l.read === "Inaccessible" && (
                    <div className="text-[#B45309] font-sans text-[12px]">
                      Inaccessible: {l.inaccessibleReason}
                    </div>
                  )}
                  {l.inBaseline === false && (
                    <div className="text-risk-red font-sans text-[12px]">
                      Not in the host's PGP baseline
                    </div>
                  )}
                </td>
                <td className="py-1.5">{l.heldIn ?? l.keyring}</td>
                <td className="py-1.5">{l.placedBy ?? "Discovery"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length > shown.length && (
        <div className="text-[12px] text-muted-foreground mt-1">
          and {list.length - shown.length} more
        </div>
      )}
    </Section>
  );
}

function OwnLocations({ k }: { k: OwnKey }) {
  const retry = () => {
    const res = retryFailed(k.id);
    const ok = res.filter((r) => r.outcome === "Succeeded").length;
    const bad = res.filter((r) => r.outcome === "Failed").length;
    if (bad) toast.error(`${ok} placed, ${bad} still failing`);
    else toast.success(`${ok} location${ok === 1 ? "" : "s"} placed on retry`);
  };
  return (
    <>
      <Locations
        title="Private key locations"
        list={k.privateLocations}
        empty={
          k.notProvisioned
            ? "Not provisioned. Use Provision PGP Key to place the private key on a host."
            : "The private key is not on any host."
        }
        right={
          k.management === "Managed" && k.storage !== "Host only" ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-[13px]">
              <Link to="/inventory/pgp/provision" search={{ key: k.id }}>
                Provision
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Locations
        title="Public copies"
        list={k.publicCopies}
        empty="No public copies placed by AppViewX."
      />
      {k.failedLocations.length > 0 && (
        <Section
          title={`Failed locations (${k.failedLocations.length})`}
          right={
            <Button size="sm" variant="outline" className="h-7 text-[13px]" onClick={retry}>
              <RotateCw className="h-3 w-3 mr-1" /> Retry failed
            </Button>
          }
        >
          <ul className="space-y-1 text-[13px]">
            {k.failedLocations.map((f, i) => (
              <li key={i}>
                <span className="font-medium">
                  {f.host} / {f.osUser}
                </span>{" "}
                <span className="text-muted-foreground">({f.role})</span>:{" "}
                <span className="text-risk-red">{f.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function OwnExtras({ k }: { k: OwnKey }) {
  const s = usePgp();
  return (
    <>
      <Section title="Links">
        <div className="grid grid-cols-2 gap-4">
          <KV
            label="SSH key"
            value={
              k.linkedSshKeyId ? (
                <Link
                  to="/inventory/keys/user"
                  search={{ highlight: k.linkedSshKeyId }}
                  className="text-primary hover:underline"
                >
                  Authentication subkey also used as an SSH key
                </Link>
              ) : (
                "None"
              )
            }
          />
          <KV
            label="Git signing"
            value={
              k.gitRefs.length
                ? k.gitRefs.map((g) => `${g.host} / ${g.osUser} (${g.level})`).join(", ")
                : "None"
            }
          />
        </div>
      </Section>
      <Section title="Revocation certificate and publication">
        <div className="grid grid-cols-2 gap-4">
          <KV
            label="Revocation certificate"
            value={
              k.revCert === "Stored" ? (
                <span className="inline-flex items-center gap-1 text-[#15803D]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Stored in {k.revCertWhere}
                </span>
              ) : (
                <span className="text-risk-red">Missing</span>
              )
            }
          />
          <KV
            label="Publication"
            value={
              k.publication === "Not published"
                ? "Not published"
                : `${k.publication}${k.publishedAt ? `, last published ${fmtDate(k.publishedAt)}` : ""}${s.settings.keyserver ? ` to ${s.settings.keyserver}` : ""}`
            }
          />
        </div>
      </Section>
      <Section title="Management">
        <div className="grid grid-cols-2 gap-4">
          {k.generated && (
            <KV label="Generated" value={`${fmtDate(k.generated.at)} by ${k.generated.by}`} />
          )}
          {k.onboarded && (
            <KV
              label="Onboarded"
              value={`${fmtDate(k.onboarded.at)} by ${k.onboarded.by}. ${k.onboarded.note}`}
            />
          )}
          {k.vault && (
            <KV
              label="CyberArk"
              value={`${k.vault.vaultConfig}, safe ${k.vault.safeName}, account ${k.vault.pamAccountName}`}
            />
          )}
          {k.tags.length > 0 && <KV label="Tags" value={k.tags.join(", ")} />}
          {k.lastOperation && (
            <KV
              label="Last operation"
              value={`${k.lastOperation.action}, ${k.lastOperation.outcome}, ${fmtDate(k.lastOperation.at)} by ${k.lastOperation.user}`}
            />
          )}
          {!k.generated && !k.onboarded && (
            <KV label="Found by" value={`Discovery, last seen ${fmtDate(k.lastDiscovered)}`} />
          )}
        </div>
      </Section>
    </>
  );
}

function ApprovalSection({ k }: { k: TrustedKey }) {
  const s = usePgp();
  const replaced = k.replaces ? s.trusted.find((x) => x.id === k.replaces) : undefined;
  const replacement = k.replacedBy ? s.trusted.find((x) => x.id === k.replacedBy) : undefined;
  return (
    <Section title="Approval">
      <div className="grid grid-cols-2 gap-4">
        {k.type === "Repository" ? (
          <KV
            label="Approval"
            value="Repository keys are trusted through the policy's Approved Repository Keys list."
            className="col-span-2"
          />
        ) : (
          <>
            <KV label="Status" value={k.approval} />
            <KV
              label="Imported"
              value={
                k.imported ? `${fmtDate(k.imported.at)} by ${k.imported.by}` : "Found by discovery"
              }
            />
            {k.decision && (
              <KV
                label={k.decision.decision === "Rejected" ? "Rejected" : "Approved by"}
                value={`${k.decision.by}, ${fmtDate(k.decision.at)}`}
              />
            )}
            {k.decision && <KV label="How the fingerprint was confirmed" value={k.decision.note} />}
            {k.policyCheck && (
              <KV
                label="Policy check at import"
                value={k.policyCheck.join(" · ")}
                className="col-span-2"
              />
            )}
          </>
        )}
        {replaced && <KV label="Replaces" value={keyName(replaced)} />}
        {replacement && (
          <KV
            label="Being replaced by"
            value={`${keyName(replacement)}. Confirm Cutover once it is on every host.`}
          />
        )}
      </div>
    </Section>
  );
}
