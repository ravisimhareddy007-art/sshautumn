// Pure PGP rules: status, next expiry, purpose, risks, compliance and action availability.
import {
  daysBetween,
  daysFromToday,
  GROUP_POLICY,
  type OwnKey,
  type PgpAlgo,
  type PgpKey,
  type PgpPolicy,
  type Purpose,
  type Subkey,
  type TrustedKey,
} from "@/data/pgp";

export type KeyStatus = "Active" | "Expiring" | "Expired" | "Revoked" | "Retired";
export type SubkeyStatus = KeyStatus;

export const OWN_RISKS = [
  "Expired",
  "Expiring",
  "Subkey expired",
  "No Expiry",
  "Revoked but present",
  "Weak",
  "Shared",
  "Misplaced",
  "Orphaned",
  "Rogue",
] as const;
export const TRUSTED_RISKS = [
  "Expired",
  "Expiring",
  "No Expiry",
  "Revoked but present",
  "Weak",
  "Not approved",
  "Untrusted repository",
] as const;
export type OwnRisk = (typeof OWN_RISKS)[number];
export type TrustedRisk = (typeof TRUSTED_RISKS)[number];

export const RISK_HELP: Record<string, string> = {
  Expired: "The primary key has passed its expiry date.",
  Expiring: "The next expiry falls within the policy's Expiring Threshold.",
  "Subkey expired": "A purpose has no usable subkey left because its subkeys expired.",
  "No Expiry": "The primary key never expires.",
  "Revoked but present": "The key is revoked but still sits on one or more hosts.",
  Weak: "RSA under 2048 bits, DSA, ElGamal or a version 3 key.",
  Shared:
    "The same private key is on more than one host or OS user. Smart card stubs are not counted.",
  Misplaced:
    "The private key sits somewhere it should not, such as outside a GnuPG home or readable by others.",
  Orphaned: "The OS user that holds the key no longer exists on the host.",
  Rogue:
    "The key appeared on a host after its PGP baseline was taken and AppViewX did not place it.",
  "Not approved": "The partner key has not been approved by a second person.",
  "Untrusted repository":
    "The repository signing key is not on the policy's Approved Repository Keys list.",
};

export function policyFor(group: string, policies: PgpPolicy[]): PgpPolicy {
  const id = GROUP_POLICY[group] ?? "pol-default";
  return policies.find((p) => p.id === id) ?? policies[0];
}

export const isPast = (d: string | null) => d !== null && daysFromToday(d) < 0;

export function subkeyStatus(s: Subkey, threshold: number): SubkeyStatus {
  if (s.revoked) return "Revoked";
  if (s.retiredBy) return "Retired";
  if (isPast(s.expires)) return "Expired";
  if (s.expires !== null && daysFromToday(s.expires) <= threshold) return "Expiring";
  return "Active";
}

export const isUsable = (s: Subkey) => !s.revoked && !s.retiredBy && !isPast(s.expires);

/** Earliest future expiry of the primary key and usable subkeys. */
export function nextExpiryRaw(k: PgpKey): string | null {
  const dates: string[] = [];
  if (k.primary.expires && !isPast(k.primary.expires)) dates.push(k.primary.expires);
  for (const s of k.subkeys) if (isUsable(s) && s.expires) dates.push(s.expires);
  if (!dates.length) return null;
  return dates.sort()[0];
}

export function keyStatus(k: PgpKey, threshold: number): KeyStatus {
  if (k.primary.revoked) return "Revoked";
  if (k.kind === "own" && k.retired) return "Retired";
  if (isPast(k.primary.expires)) return "Expired";
  const nx = nextExpiryRaw(k);
  if (nx && daysFromToday(nx) <= threshold) return "Expiring";
  return "Active";
}

/** Value shown in the Next Expiry column. Blank for Revoked, Retired and Expired keys. */
export function nextExpiryDisplay(
  k: PgpKey,
  status: KeyStatus,
): { kind: "blank" } | { kind: "none" } | { kind: "date"; date: string; days: number } {
  if (status === "Revoked" || status === "Retired" || status === "Expired")
    return { kind: "blank" };
  const nx = nextExpiryRaw(k);
  if (!nx) return { kind: "none" };
  return { kind: "date", date: nx, days: daysFromToday(nx) };
}

export function purposes(k: PgpKey, status: KeyStatus): Purpose[] {
  if (status === "Revoked" || status === "Retired" || status === "Expired") return [];
  const set = new Set<Purpose>();
  if (k.primary.canSign) set.add("Sign");
  for (const s of k.subkeys) if (isUsable(s)) set.add(s.purpose);
  const order: Purpose[] = ["Encrypt", "Sign", "Authenticate"];
  return order.filter((p) => set.has(p));
}

export function algoLabel(a: PgpAlgo): string {
  if (a.family === "RSA" || a.family === "DSA" || a.family === "ElGamal")
    return `${a.family} ${a.size ?? ""}`.trim();
  if (a.family === "ECDSA" || a.family === "ECDH") return `${a.family} ${a.curve ?? ""}`.trim();
  return a.family;
}

export function isWeakAlgo(a: PgpAlgo): boolean {
  if (a.family === "RSA") return (a.size ?? 0) < 2048;
  return a.family === "DSA" || a.family === "ElGamal";
}

export function hasWeak(k: PgpKey): boolean {
  if (k.primary.v3 || isWeakAlgo(k.primary.algo)) return true;
  return k.subkeys.some((s) => !s.revoked && !s.retiredBy && isWeakAlgo(s.algo));
}

/** Purposes whose subkeys have all expired, leaving none usable. */
export function expiredSubkeyPurposes(k: PgpKey): Purpose[] {
  const out: Purpose[] = [];
  const byPurpose = new Map<Purpose, Subkey[]>();
  for (const s of k.subkeys) {
    if (s.revoked || s.retiredBy) continue;
    byPurpose.set(s.purpose, [...(byPurpose.get(s.purpose) ?? []), s]);
  }
  for (const [p, list] of byPurpose)
    if (list.length && list.every((s) => isPast(s.expires))) out.push(p);
  return out;
}

export function sharedCount(k: OwnKey): number {
  return k.privateLocations.filter((l) => l.heldIn !== "Smart card").length;
}

export function ownRisks(k: OwnKey, policy: PgpPolicy): OwnRisk[] {
  const st = keyStatus(k, policy.expiringThreshold);
  const r: OwnRisk[] = [];
  if (st === "Expired") r.push("Expired");
  if (st === "Expiring") r.push("Expiring");
  if (st !== "Revoked" && st !== "Retired" && st !== "Expired" && expiredSubkeyPurposes(k).length)
    r.push("Subkey expired");
  if (st !== "Revoked" && st !== "Retired" && k.primary.expires === null) r.push("No Expiry");
  if (st === "Revoked" && k.privateLocations.length + k.publicCopies.length > 0)
    r.push("Revoked but present");
  if (hasWeak(k)) r.push("Weak");
  if (sharedCount(k) > 1) r.push("Shared");
  if (k.privateLocations.some((l) => l.misplaced)) r.push("Misplaced");
  if (k.orphaned) r.push("Orphaned");
  if (
    k.management !== "Managed" &&
    k.privateLocations.some((l) => l.inBaseline === false && l.placedBy !== "AVX SSH")
  )
    r.push("Rogue");
  return r;
}

export function repoApproved(k: TrustedKey, policy: PgpPolicy): boolean {
  return policy.approvedRepoKeys.some((a) => a.fingerprint === k.primary.fingerprint);
}

export function trustedRisks(k: TrustedKey, policy: PgpPolicy): TrustedRisk[] {
  const st = keyStatus(k, policy.expiringThreshold);
  const r: TrustedRisk[] = [];
  if (st === "Expired") r.push("Expired");
  if (st === "Expiring") r.push("Expiring");
  if (st !== "Revoked" && st !== "Expired" && k.primary.expires === null) r.push("No Expiry");
  if (st === "Revoked" && k.locations.length > 0) r.push("Revoked but present");
  if (hasWeak(k)) r.push("Weak");
  if (k.type === "Partner" && k.approval !== "Approved") r.push("Not approved");
  if (k.type === "Repository" && !repoApproved(k, policy)) r.push("Untrusted repository");
  return r;
}

export function algoAllowed(a: PgpAlgo, p: PgpPolicy): boolean {
  switch (a.family) {
    case "RSA":
      return p.rsaMin !== null && (a.size ?? 0) >= p.rsaMin;
    case "Ed25519":
    case "Cv25519":
      return p.ed25519;
    case "ECDSA":
    case "ECDH":
      return !!a.curve && p.ecdsaCurves.includes(a.curve);
    default:
      return false;
  }
}

export type Compliance =
  | { state: "Compliant" }
  | { state: "Non-Compliant"; reasons: string[] }
  | { state: "Not evaluated" };

export function compliance(k: OwnKey, p: PgpPolicy): Compliance {
  if (!p.evaluate) return { state: "Not evaluated" };
  const st = keyStatus(k, p.expiringThreshold);
  const reasons: string[] = [];
  const risks = ownRisks(k, p);
  if (st !== "Revoked" && st !== "Retired") {
    if (!algoAllowed(k.primary.algo, p))
      reasons.push(`Primary key algorithm ${algoLabel(k.primary.algo)} is not allowed`);
    for (const s of k.subkeys.filter(isUsable)) {
      if (!algoAllowed(s.algo, p))
        reasons.push(`${s.purpose} subkey algorithm ${algoLabel(s.algo)} is not allowed`);
    }
    if (p.expiryRequired && k.primary.expires === null) reasons.push("Primary key has no expiry");
    if (p.maxValidityPrimary !== null) {
      const v =
        k.primary.expires === null
          ? Infinity
          : daysBetween(k.primary.expirySetAt, k.primary.expires);
      if (v > p.maxValidityPrimary)
        reasons.push(`Primary key validity exceeds ${p.maxValidityPrimary} days`);
    }
    if (p.maxValiditySubkeys !== null) {
      for (const s of k.subkeys.filter(isUsable)) {
        const v = s.expires === null ? Infinity : daysBetween(s.expirySetAt, s.expires);
        if (v > p.maxValiditySubkeys)
          reasons.push(`${s.purpose} subkey validity exceeds ${p.maxValiditySubkeys} days`);
      }
    }
    if (p.revCertRequired && k.revCert === "Missing")
      reasons.push("Revocation certificate missing");
  }
  for (const r of risks) if (!p.allowedRisks.includes(r)) reasons.push(`Risk not allowed: ${r}`);
  return reasons.length ? { state: "Non-Compliant", reasons } : { state: "Compliant" };
}

// ─── Action availability ────────────────────────────────────────────────────────

export type Availability = { ok: true } | { ok: false; reason: string };
const OK: Availability = { ok: true };
const no = (reason: string): Availability => ({ ok: false, reason });

export const OWN_ACTIONS = [
  "Provision PGP Key",
  "Onboard",
  "Extend Expiry",
  "Rotate Subkey",
  "Revoke",
  "Create Revocation Certificate",
  "Retire",
  "Reactivate",
  "Publish",
  "Export for WKD",
  "Export Public Key",
  "Download Private Key",
  "Delete",
] as const;
export type OwnAction = (typeof OWN_ACTIONS)[number];

const OWN_MULTI: OwnAction[] = ["Extend Expiry", "Export Public Key", "Delete"];
const DISCOVERED_ALLOWED: OwnAction[] = ["Onboard", "Revoke", "Delete"];

export function ownActionAvailability(
  action: OwnAction,
  keys: OwnKey[],
  ctx: { keyserver: string | null; threshold: (k: OwnKey) => number },
): Availability {
  if (!keys.length) return no("Select a key");
  if (keys.length > 1 && !OWN_MULTI.includes(action)) return no("Select one key");
  for (const k of keys) {
    const r = singleOwn(action, k, ctx);
    if (!r.ok) return keys.length > 1 ? no(`${k.userIds[0]?.name ?? "A key"}: ${r.reason}`) : r;
  }
  return OK;
}

function singleOwn(
  action: OwnAction,
  k: OwnKey,
  ctx: { keyserver: string | null; threshold: (k: OwnKey) => number },
): Availability {
  const st = keyStatus(k, ctx.threshold(k));
  if (k.management === "Discovered" && !DISCOVERED_ALLOWED.includes(action))
    return no("Onboard the key first");
  switch (action) {
    case "Onboard":
      return k.management === "Discovered" ? OK : no("The key is already managed");
    case "Provision PGP Key":
      if (k.storage === "Host only")
        return no("The private key is not held in AppViewX or CyberArk");
      if (st === "Revoked" || st === "Retired" || st === "Expired")
        return no(`The key is ${st.toLowerCase()}`);
      return OK;
    case "Extend Expiry":
      if (st === "Revoked" || st === "Retired") return no(`The key is ${st.toLowerCase()}`);
      return OK;
    case "Rotate Subkey":
      if (st === "Revoked" || st === "Retired" || st === "Expired")
        return no(`The key is ${st.toLowerCase()}`);
      if (!k.subkeys.some((s) => !s.revoked && !s.retiredBy))
        return no("The key has no subkeys to rotate");
      return OK;
    case "Revoke":
      return st === "Revoked" ? no("The key is already revoked") : OK;
    case "Create Revocation Certificate":
      if (st === "Revoked") return no("The key is already revoked");
      return k.revCert === "Missing" ? OK : no("A revocation certificate is already stored");
    case "Retire":
      if (st === "Revoked") return no("The key is revoked");
      return st === "Retired" ? no("The key is already retired") : OK;
    case "Reactivate":
      return st === "Retired" ? OK : no("Only a retired key can be reactivated");
    case "Publish":
      if (!ctx.keyserver) return no("Set a keyserver in PGP Settings");
      if (st === "Retired") return no("The key is retired");
      return k.publication === "Published" ? no("The published copy is already up to date") : OK;
    case "Export for WKD":
      if (st === "Revoked" || st === "Retired") return no(`The key is ${st.toLowerCase()}`);
      return k.userIds.some((u) => !u.revoked && u.email)
        ? OK
        : no("No user ID has an email address");
    case "Export Public Key":
      return OK;
    case "Download Private Key":
      return k.storage === "AppViewX"
        ? OK
        : no(
            k.storage === "CyberArk"
              ? "The private key is held in CyberArk"
              : "The private key is not held in AppViewX",
          );
    case "Delete":
      return OK;
  }
}

export const TRUSTED_ACTIONS = [
  "Approve or Reject",
  "Distribute",
  "Replace",
  "Confirm Cutover",
  "Remove from Hosts",
  "Delete From Inventory",
  "Export Public Key",
] as const;
export type TrustedAction = (typeof TRUSTED_ACTIONS)[number];
const TRUSTED_MULTI: TrustedAction[] = ["Export Public Key", "Delete From Inventory"];

export function trustedActionAvailability(
  action: TrustedAction,
  keys: TrustedKey[],
  ctx: { currentUser: string; threshold: (k: TrustedKey) => number; all: TrustedKey[] },
): Availability {
  if (!keys.length) return no("Select a key");
  if (keys.length > 1 && !TRUSTED_MULTI.includes(action)) return no("Select one key");
  const k = keys[0];
  const st = keyStatus(k, ctx.threshold(k));
  switch (action) {
    case "Approve or Reject":
      if (k.type === "Repository")
        return no("Repository keys are approved through the policy's Approved Repository Keys");
      if (k.approval !== "Pending") return no("Only a pending key can be approved or rejected");
      if (k.imported?.by === ctx.currentUser)
        return no("The person who imported the key cannot approve it");
      return OK;
    case "Distribute":
      if (k.type === "Repository") return no("Repository keys are placed by the package manager");
      if (k.approval !== "Approved") return no("Approve the key first");
      if (st === "Revoked" || st === "Expired") return no(`The key is ${st.toLowerCase()}`);
      return OK;
    case "Replace":
      if (k.type === "Repository") return no("Repository keys are replaced by the package manager");
      if (k.replacedBy) return no("A replacement is already in progress");
      if (!k.locations.length) return no("The key is not on any host");
      return OK;
    case "Confirm Cutover": {
      if (!k.replacedBy) return no("Replace the key first");
      const nk = ctx.all.find((x) => x.id === k.replacedBy);
      if (!nk) return no("The replacement key is no longer in the inventory");
      const missing = k.locations.filter(
        (l) => !nk.locations.some((m) => m.host === l.host && m.osUser === l.osUser),
      );
      if (missing.length)
        return no(
          `The new key is not yet on ${missing.length} location${missing.length > 1 ? "s" : ""}`,
        );
      return OK;
    }
    case "Remove from Hosts":
      return k.locations.length ? OK : no("The key is not on any host");
    case "Delete From Inventory":
      return OK;
    case "Export Public Key":
      return OK;
  }
}

/** Days within which a date counts for a risk tile window. */
export function withinWindow(k: PgpKey, status: KeyStatus, window: number): boolean {
  if (status === "Revoked" || status === "Retired" || status === "Expired") return false;
  const nx = nextExpiryRaw(k);
  return !!nx && daysFromToday(nx) <= window;
}
