import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Lock, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { fmtDate, groupedFp, keyIdOf, type OwnKey, type PgpKey, type PgpLocation, type TrustedKey } from "@/data/pgp";
import { algoLabel, RISK_HELP, subkeyStatus, type KeyStatus } from "@/lib/pgp-rules";
import { keyName, retryFailed, usePgp } from "@/lib/pgp-store";
import { ComplianceCell, derive, DotPill, KV, NextExpiryCell, PanelTable, Pill, PurposeList, RiskList, Section, StatusBadge } from "./pgp-ui";

export function PgpDetailDrawer({ keyId, onClose }: { keyId: string | null; onClose: () => void }) {
  const s = usePgp();
  const k: PgpKey | undefined = s.own.find((x) => x.id === keyId) ?? s.trusted.find((x) => x.id === keyId);
  return (
    <Sheet open={!!keyId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[540px] gap-0 overflow-y-auto p-0 sm:max-w-[540px]">
        {k && <Body k={k} />}
      </SheetContent>
    </Sheet>
  );
}

const muted = (t: ReactNode) => <span className="text-[#6B7280]">{t}</span>;

function Body({ k }: { k: PgpKey }) {
  const s = usePgp();
  const d = derive(k, s.policies);
  const own = k.kind === "own" ? k : null;
  const tr = k.kind === "trusted" ? k : null;
  const primaryUid = k.userIds.find((u) => u.primary) ?? k.userIds[0];
  const copy = () => {
    navigator.clipboard?.writeText(k.primary.fingerprint).catch(() => undefined);
    toast.success("Fingerprint copied");
  };
  const lastOp = own?.lastOperation ?? (k.history.length ? k.history[k.history.length - 1] : undefined);

  return (
    <div>
      <div className="sticky top-0 z-10 flex h-[60px] items-center border-b border-border bg-white px-6 pr-12">
        <SheetTitle className="truncate text-[17px] font-medium text-[#111827]">{keyName(k)}</SheetTitle>
      </div>

      <Section title="Key">
        <div className="divide-y divide-[#F1F2F5]">
          <KV label="User ID" value={primaryUid ? `${primaryUid.name}${primaryUid.email ? ` <${primaryUid.email}>` : ""}` : muted("—")} />
          {k.userIds.length > 1 && <KV label="Other User IDs" value={k.userIds.filter((u) => u !== primaryUid).map((u) => u.email ?? u.name).join(", ")} />}
          <KV
            label="Fingerprint"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-[12px] leading-[18px]">{groupedFp(k.primary.fingerprint)}</span>
                <button onClick={copy} className="shrink-0 rounded p-1 hover:bg-muted" title="Copy fingerprint" aria-label="Copy fingerprint">
                  <Copy className="h-3.5 w-3.5 text-[#6B7280]" />
                </button>
              </span>
            }
          />
          <KV label="Key ID" value={<span className="font-mono text-[12.5px]">{keyIdOf(k.primary.fingerprint)}</span>} />
          <KV label="Status" value={<StatusBadge status={d.status} />} />
          {tr && <KV label="Type" value={<Pill>{tr.type}</Pill>} />}
          <KV label="Purpose" value={<span className="inline-flex justify-end"><PurposeList list={d.purposes} /></span>} />
          <KV label="Algorithm" value={algoLabel(k.primary.algo)} />
          <KV label="Created" value={fmtDate(k.primary.created)} />
          <KV label="Primary Expiry" value={k.primary.expires ? fmtDate(k.primary.expires) : muted("No expiry")} />
          <KV label="Next Expiry" value={<NextExpiryCell k={k} status={d.status} />} />
          <KV label="Key Group" value={`${k.group} (${d.policy.name})`} />
          {own && (
            <>
              <KV label="Management" value={<DotPill tone={own.management === "Managed" ? "purple" : "grey"}>{own.management}</DotPill>} />
              <KV
                label="Storage"
                value={
                  own.storage === "CyberArk" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-primary" /> CyberArk{own.vault ? `, safe ${own.vault.safeName}` : ""}
                    </span>
                  ) : own.storage === "Host only" ? (
                    "Hosts only"
                  ) : (
                    own.storage
                  )
                }
              />
              <KV label="Revocation Certificate" value={<DotPill tone={own.revCert === "Stored" ? "green" : "red"}>{own.revCert === "Stored" ? `Stored in ${own.revCertWhere}` : "Missing"}</DotPill>} />
              <KV
                label="Linked SSH Key"
                value={
                  own.linkedSshKeyId ? (
                    <Link to="/inventory/keys/user" search={{ highlight: own.linkedSshKeyId }} className="text-primary hover:underline">
                      Authentication subkey
                    </Link>
                  ) : (
                    muted("None")
                  )
                }
              />
              <KV label="Git Reference" value={own.gitRefs.length ? own.gitRefs.map((g) => `${g.host} / ${g.osUser} (${g.level})`).join(", ") : muted("None")} />
              <KV
                label="Publication"
                value={
                  <DotPill tone={own.publication === "Published" ? "green" : own.publication === "Out of date" ? "amber" : "grey"} title={own.publishedAt ? `Last published ${fmtDate(own.publishedAt)}` : undefined}>
                    {own.publication}
                  </DotPill>
                }
              />
              <KV label="Compliance" value={d.compliance && <ComplianceCell c={d.compliance} />} />
              <KV label="Passphrase" value={own.passphrase} />
              {own.tags.length > 0 && <KV label="Tags" value={own.tags.join(", ")} />}
              {own.generated && <KV label="Generated" value={`${fmtDate(own.generated.at)} by ${own.generated.by}`} />}
              {own.onboarded && <KV label="Onboarded" value={`${fmtDate(own.onboarded.at)} by ${own.onboarded.by}`} />}
            </>
          )}
          {tr && (
            <>
              <KV label="Source" value={tr.source} />
              {tr.repoManager && <KV label="Package Manager" value={tr.repoManager} />}
            </>
          )}
          <KV label="Last Operation" value={lastOp ? `${lastOp.action} · ${fmtDate(lastOp.at)}` : muted("None")} />
          <KV label="Last Discovered" value={k.lastDiscovered ? fmtDate(k.lastDiscovered) : muted("Not yet")} />
        </div>
      </Section>

      <Section title="Key parts">
        <KeyParts k={k} status={d.status} threshold={d.policy.expiringThreshold} />
      </Section>

      {own ? <OwnLocations k={own} /> : tr && <LocationTable title="Locations" list={tr.locations.map((l) => ({ l, holds: "Public key" }))} empty="Not on any host yet. Use Distribute to place it." />}

      <Section title="Risks">
        {d.risks.length === 0 ? (
          <div className="text-[13.5px] text-[#6B7280]">No risks found.</div>
        ) : (
          <div className="space-y-2.5">
            <RiskList risks={d.risks} />
            <ul className="space-y-1.5 text-[13px] text-[#374151]">
              {d.risks.map((r) => (
                <li key={r}>
                  <span className="font-medium">{r}.</span> {RISK_HELP[r]}
                  {own && d.policy.allowedRisks.includes(r) && <span className="text-[#6B7280]"> Allowed by policy.</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.compliance?.state === "Non-Compliant" && (
          <div className="mt-3 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px]">
            <div className="mb-1 font-medium text-[#B91C1C]">Why it is non-compliant</div>
            <ul className="list-disc space-y-0.5 pl-4 text-[#374151]">
              {d.compliance.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {tr && <ApprovalSection k={tr} />}

      <Section title="History">
        {k.history.length === 0 ? (
          <div className="text-[13.5px] text-[#6B7280]">No operations yet. Found by discovery{k.lastDiscovered ? ` on ${fmtDate(k.lastDiscovered)}` : ""}.</div>
        ) : (
          <PanelTable
            head={["Date", "Operation", "By", "Result"]}
            rows={[...k.history].reverse().map((o) => [
              <span className="whitespace-nowrap">{fmtDate(o.at)}</span>,
              <span title={o.detail}>{o.action}</span>,
              o.user,
              <DotPill tone={o.outcome === "Succeeded" ? "green" : o.outcome === "Failed" ? "red" : "amber"}>{o.outcome}</DotPill>,
            ])}
          />
        )}
      </Section>
    </div>
  );
}

function KeyParts({ k, status, threshold }: { k: PgpKey; status: KeyStatus; threshold: number }) {
  const primaryLabel = k.primary.canSign ? "Primary (certify, sign)" : "Primary (certify)";
  const rows: ReactNode[][] = [
    [primaryLabel, algoLabel(k.primary.algo), k.primary.expires ? fmtDate(k.primary.expires) : "No expiry", <StatusBadge status={status} />],
    ...k.subkeys.map((sk) => {
      const st = subkeyStatus(sk, threshold) as KeyStatus | "";
      const note = sk.retiredBy === "rotate" ? "Replaced by rotation" : sk.retiredBy === "retire" ? "Ended by Retire" : sk.revoked ? sk.revoked.reason : undefined;
      return [
        <span title={sk.fingerprint}>{sk.purpose === "Authenticate" ? "Authentication" : sk.purpose === "Encrypt" ? "Encryption" : "Signing"}</span>,
        algoLabel(sk.algo),
        sk.expires ? fmtDate(sk.expires) : "No expiry",
        <span title={note}>{st ? <StatusBadge status={st} /> : <DotPill tone="grey">Follows key</DotPill>}</span>,
      ];
    }),
  ];
  return <PanelTable head={["Part", "Algorithm", "Expires", "Status"]} rows={rows} />;
}

function LocationTable({ title, list, empty, right }: { title: string; list: { l: PgpLocation; holds: string }[]; empty: string; right?: ReactNode }) {
  const shown = list.slice(0, 15);
  return (
    <Section title={`${title} (${list.length})`} right={right}>
      <PanelTable
        head={["Host", "OS user", "Keyring", "Holds"]}
        empty={empty}
        rows={shown.map(({ l, holds }) => [
          <div>
            <div>{l.host}</div>
            {l.misplaced && <div className="text-[12px] text-[#DC2626]">Misplaced: {l.misplaced}</div>}
            {l.read === "Inaccessible" && <div className="text-[12px] text-[#B45309]">Inaccessible: {l.inaccessibleReason}</div>}
            {l.inBaseline === false && <div className="text-[12px] text-[#DC2626]">Not in the host's PGP baseline</div>}
          </div>,
          l.osUser,
          <span className="font-mono text-[12px] break-all" title={l.path}>
            {l.heldIn ?? l.keyring}
          </span>,
          <span className="whitespace-nowrap">{holds}</span>,
        ])}
      />
      {list.length > shown.length && <div className="mt-1.5 text-[12.5px] text-[#6B7280]">and {list.length - shown.length} more</div>}
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
  const list = [...k.privateLocations.map((l) => ({ l, holds: "Private key" })), ...k.publicCopies.map((l) => ({ l, holds: "Public copy" }))];
  return (
    <>
      <LocationTable
        title="Locations"
        list={list}
        empty={k.notProvisioned ? "Not provisioned. Use Provision PGP Key to place the private key on a host." : "The key is not on any host."}
        right={
          k.management === "Managed" && k.storage !== "Host only" ? (
            <Link to="/inventory/pgp/provision" search={{ key: k.id }} className="text-[13.5px] text-primary hover:underline">
              Provision
            </Link>
          ) : undefined
        }
      />
      {k.failedLocations.length > 0 && (
        <Section
          title={`Failed locations (${k.failedLocations.length})`}
          right={
            <button onClick={retry} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 text-[13px] hover:bg-[#F9FAFB]">
              <RotateCw className="h-3.5 w-3.5" /> Retry failed
            </button>
          }
        >
          <PanelTable
            head={["Host", "OS user", "Receives", "Reason"]}
            rows={k.failedLocations.map((f) => [f.host, f.osUser, f.role, <span className="text-[#DC2626]">{f.reason}</span>])}
          />
        </Section>
      )}
    </>
  );
}

function ApprovalSection({ k }: { k: TrustedKey }) {
  const s = usePgp();
  const replaced = k.replaces ? s.trusted.find((x) => x.id === k.replaces) : undefined;
  const replacement = k.replacedBy ? s.trusted.find((x) => x.id === k.replacedBy) : undefined;
  return (
    <Section title="Approval">
      <div className="divide-y divide-[#F1F2F5]">
        {k.type === "Repository" ? (
          <KV label="Approval" value="Set by policy (Approved Repository Keys)" />
        ) : (
          <>
            <KV label="Status" value={<DotPill tone={k.approval === "Approved" ? "green" : k.approval === "Pending" ? "amber" : "red"}>{k.approval}</DotPill>} />
            <KV label="Imported" value={k.imported ? `${fmtDate(k.imported.at)} by ${k.imported.by}` : "Found by discovery"} />
            {k.decision && <KV label={k.decision.decision === "Rejected" ? "Rejected by" : "Decided by"} value={`${k.decision.by}, ${fmtDate(k.decision.at)}`} />}
            {k.decision?.note && <KV label="Fingerprint confirmed" value={k.decision.note} />}
            {k.policyCheck && <KV label="Policy check at import" value={k.policyCheck.join(" · ")} />}
          </>
        )}
        {replaced && <KV label="Replaces" value={keyName(replaced)} />}
        {replacement && <KV label="Being replaced by" value={`${keyName(replacement)}. Confirm Cutover once it is on every host.`} />}
      </div>
    </Section>
  );
}
