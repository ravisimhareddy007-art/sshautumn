// Single shared source of truth for the PGP module. Every screen reads from here and
// every action writes here, so the inventory, detail view, dashboard and policy stay in step.
import { useSyncExternalStore } from "react";
import {
  CURRENT_USER,
  LOOKUP_CATALOG,
  PGP_HOSTS,
  SEED_OWN_KEYS,
  SEED_POLICIES,
  SEED_TRUSTED_KEYS,
  keyIdOf,
  makeFingerprint,
  rel,
  type DeletedPgpKey,
  type FailedLocation,
  type Operation,
  type OwnKey,
  type PgpAlgo,
  type PgpKey,
  type PgpLocation,
  type KeyPolicy,
  type Purpose,
  type Subkey,
  type TrustedKey,
  type UserId,
  type VaultConfig,
} from "@/data/pgp";
import { isUsable, policyFor } from "@/lib/pgp-rules";
import {
  SEED_INFRA_GROUPS,
  SEED_RUNS,
  SEED_SCHEDULES,
  ipToNumber,
  type DiscoverTarget,
  type DiscoveryRun,
  type DiscoverySchedule,
  type InfraAccessGroup,
} from "@/data/discovery";

export interface PgpSettings {
  keyserver: string;
  wkdDomain: string;
}
export interface PgpDiscovery {
  enabled: boolean;
  paths: string[];
}
export interface AuditEntry extends Operation {
  keyName: string;
}

export interface PgpState {
  runs: DiscoveryRun[];
  schedules: DiscoverySchedule[];
  infraGroups: InfraAccessGroup[];
  own: OwnKey[];
  trusted: TrustedKey[];
  policies: KeyPolicy[];
  deleted: DeletedPgpKey[];
  audit: AuditEntry[];
  settings: PgpSettings;
  discovery: PgpDiscovery;
  /** Host:user pairs that already failed once, so a retry succeeds. */
  flakyTried: string[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

let state: PgpState = {
  runs: clone(SEED_RUNS),
  schedules: clone(SEED_SCHEDULES),
  infraGroups: clone(SEED_INFRA_GROUPS),
  own: clone(SEED_OWN_KEYS),
  trusted: clone(SEED_TRUSTED_KEYS),
  policies: clone(SEED_POLICIES),
  deleted: [],
  audit: [],
  settings: { keyserver: "", wkdDomain: "harborbank.example" },
  discovery: {
    enabled: true,
    paths: ["~/.gnupg", "/etc/apt/trusted.gpg.d", "/etc/pki/rpm-gpg", "/opt/*/keys"],
  },
  flakyTried: [],
};
const initial = state;

const listeners = new Set<() => void>();
function set(next: Partial<PgpState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePgp(): PgpState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}
export const getPgp = () => state;

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const keyName = (k: PgpKey) =>
  (k.kind === "trusted" && k.label) ||
  k.userIds.find((u) => u.primary)?.name ||
  k.userIds[0]?.name ||
  keyIdOf(k.primary.fingerprint);
export const thresholdFor = (k: PgpKey) => policyFor(k.group, state.policies).expiringThreshold;

function opNow(
  action: string,
  outcome: Operation["outcome"] = "Succeeded",
  detail?: string,
): Operation {
  return { action, user: CURRENT_USER, at: rel(0), outcome, detail };
}
function logOp<K extends OwnKey | TrustedKey>(k: K, o: Operation): K {
  const audit: AuditEntry = { ...o, keyName: keyName(k) };
  state = { ...state, audit: [audit, ...state.audit] };
  if (k.kind === "own") return { ...k, lastOperation: o, history: [...k.history, o] } as K;
  return { ...k, history: [...k.history, o] } as K;
}
function updateOwn(id: string, fn: (k: OwnKey) => OwnKey) {
  set({ own: state.own.map((k) => (k.id === id ? fn(k) : k)) });
}
function updateTrusted(id: string, fn: (k: TrustedKey) => TrustedKey) {
  set({ trusted: state.trusted.map((k) => (k.id === id ? fn(k) : k)) });
}
const outOfDate = (k: OwnKey): OwnKey["publication"] =>
  k.publication === "Published" ? "Out of date" : k.publication;

const ECC = (a: PgpAlgo) =>
  a.family === "Ed25519" || a.family === "Cv25519" || a.family === "ECDSA" || a.family === "ECDH";
export function algoForPurpose(name: string, purpose: Purpose): PgpAlgo {
  if (name === "Ed25519") return { family: purpose === "Encrypt" ? "Cv25519" : "Ed25519" };
  if (name.startsWith("RSA")) return { family: "RSA", size: Number(name.split(" ")[1]) };
  if (name.startsWith("ECDSA")) {
    const curve = name.split(" ")[1] as "P-256" | "P-384" | "P-521";
    return { family: purpose === "Encrypt" ? "ECDH" : "ECDSA", curve };
  }
  return { family: "Ed25519" };
}

// ─── Generate ──────────────────────────────────────────────────────────────────

export interface GenerateInput {
  group: string;
  name: string;
  email: string;
  comment: string;
  extraUserIds: { name: string; email: string }[];
  algorithm: string;
  primaryValidity: number | null;
  subkeys: { purpose: Purpose; validity: number | null }[];
  passphrase: "Generated" | "Entered";
  storage: "AppViewX" | "CyberArk";
  vault?: VaultConfig;
  tags: string[];
}

export function generateKey(input: GenerateInput): OwnKey {
  const seed = `gen-${input.name}-${Date.now()}`;
  const primaryAlgo = algoForPurpose(input.algorithm, "Sign");
  const subkeys: Subkey[] = input.subkeys.map((s, i) => ({
    id: `${seed}-${i}`,
    fingerprint: makeFingerprint(`${seed}-${i}`),
    purpose: s.purpose,
    algo: algoForPurpose(input.algorithm, s.purpose),
    created: rel(0),
    expires: s.validity === null ? null : rel(s.validity),
    expirySetAt: rel(0),
  }));
  const uids: UserId[] = [
    {
      name: input.name,
      email: input.email || undefined,
      comment: input.comment || undefined,
      primary: true,
    },
    ...input.extraUserIds
      .filter((u) => u.name || u.email)
      .map((u) => ({ name: u.name || input.name, email: u.email || undefined, primary: false })),
  ];
  const o = opNow("Generate PGP Key", "Succeeded", "Key and revocation certificate created");
  const key: OwnKey = {
    id: seed,
    kind: "own",
    primary: {
      fingerprint: makeFingerprint(seed),
      algo: primaryAlgo,
      created: rel(0),
      expires: input.primaryValidity === null ? null : rel(input.primaryValidity),
      expirySetAt: rel(0),
      canSign: true,
    },
    subkeys,
    userIds: uids,
    privateLocations: [],
    publicCopies: [],
    management: "Managed",
    storage: input.storage,
    group: input.group,
    revCert: "Stored",
    revCertWhere: input.storage === "CyberArk" ? "CyberArk" : "AppViewX",
    publication: "Not published",
    gitRefs: [],
    notProvisioned: true,
    generated: { by: CURRENT_USER, at: rel(0) },
    passphrase: input.passphrase,
    vault: input.vault,
    tags: input.tags,
    lastOperation: o,
    failedLocations: [],
    history: [o],
  };
  set({ own: [key, ...state.own], audit: [{ ...o, keyName: input.name }, ...state.audit] });
  return key;
}

// ─── Provision ─────────────────────────────────────────────────────────────────

export interface Destination {
  host: string;
  osUser: string;
  role: "Private key" | "Public copy";
}
export type PrecheckResult =
  | { ok: true; already?: boolean; checks: string[] }
  | { ok: false; reason: string; checks: string[] };

export function precheck(k: OwnKey, d: Destination): PrecheckResult {
  const h = PGP_HOSTS.find((x) => x.name === d.host);
  const checks: string[] = [];
  if (!h) return { ok: false, reason: "Host not found in Host Inventory", checks };
  if (!h.reachable)
    return { ok: false, reason: "Host not reachable", checks: ["Host reachable: No"] };
  checks.push("Host reachable");
  if (!h.users.includes(d.osUser))
    return { ok: false, reason: `OS user ${d.osUser} does not exist on ${d.host}`, checks };
  checks.push(`OS user ${d.osUser} exists`);
  if (!h.gnupg) return { ok: false, reason: "GnuPG is not installed", checks };
  if (h.gnupg.startsWith("1.") && (ECC(k.primary.algo) || k.subkeys.some((s) => ECC(s.algo))))
    return {
      ok: false,
      reason: `GnuPG ${h.gnupg} cannot use ECC keys. Upgrade to 2.1 or later`,
      checks: [...checks, `GnuPG ${h.gnupg}`],
    };
  checks.push(`GnuPG ${h.gnupg}`);
  if (h.readOnlyHome?.includes(d.osUser))
    return { ok: false, reason: `Keyring for ${d.osUser} is not writable`, checks };
  checks.push("Keyring writable");
  const list = d.role === "Private key" ? k.privateLocations : k.publicCopies;
  if (list.some((l) => l.host === d.host && l.osUser === d.osUser))
    return { ok: true, already: true, checks: [...checks, "Already present"] };
  if (
    d.role === "Public copy" &&
    k.privateLocations.some((l) => l.host === d.host && l.osUser === d.osUser)
  )
    return { ok: true, already: true, checks: [...checks, "Private key already present here"] };
  return { ok: true, checks };
}

export interface RunResult {
  dest: Destination;
  outcome: "Succeeded" | "Failed" | "Skipped";
  reason?: string;
}

function placeLocation(d: Destination): PgpLocation {
  return {
    host: d.host,
    osUser: d.osUser,
    path: d.osUser === "root" ? "/root/.gnupg" : `/home/${d.osUser}/.gnupg`,
    keyring: "GnuPG keyring",
    heldIn: "Host keyring",
    read: "Read",
    lastDiscovered: rel(0),
    placedBy: "AVX SSH",
    inBaseline: true,
  };
}

function attempt(k: OwnKey, d: Destination): RunResult {
  const pc = precheck(k, d);
  if (!pc.ok) return { dest: d, outcome: "Failed", reason: pc.reason };
  if (pc.already) return { dest: d, outcome: "Skipped", reason: "Already present" };
  const h = PGP_HOSTS.find((x) => x.name === d.host);
  const tag = `${k.id}:${d.host}:${d.osUser}`;
  if (h?.flaky && !state.flakyTried.includes(tag)) {
    state = { ...state, flakyTried: [...state.flakyTried, tag] };
    return { dest: d, outcome: "Failed", reason: "Connection timed out while importing the key" };
  }
  return { dest: d, outcome: "Succeeded" };
}

function applyResults(k: OwnKey, results: RunResult[], action: string, publish: boolean): OwnKey {
  let next = { ...k, privateLocations: [...k.privateLocations], publicCopies: [...k.publicCopies] };
  const failed: FailedLocation[] = [];
  for (const r of results) {
    if (r.outcome === "Succeeded") {
      if (r.dest.role === "Private key") next.privateLocations.push(placeLocation(r.dest));
      else next.publicCopies.push(placeLocation(r.dest));
    }
    if (r.outcome === "Failed")
      failed.push({
        host: r.dest.host,
        osUser: r.dest.osUser,
        role: r.dest.role,
        reason: r.reason ?? "Failed",
      });
  }
  // failed locations that succeeded on this run are cleared; others kept
  const retried = new Set(results.map((r) => `${r.dest.host}:${r.dest.osUser}:${r.dest.role}`));
  next.failedLocations = [
    ...k.failedLocations.filter((f) => !retried.has(`${f.host}:${f.osUser}:${f.role}`)),
    ...failed,
  ];
  if (next.privateLocations.length) next.notProvisioned = false;
  if (publish && state.settings.keyserver) {
    next.publication = "Published";
    next.publishedAt = rel(0);
  }
  const ok = results.filter((r) => r.outcome === "Succeeded").length;
  const outcome: Operation["outcome"] =
    failed.length === 0 ? "Succeeded" : ok > 0 ? "Partial" : "Failed";
  next = logOp(
    next,
    opNow(
      action,
      outcome,
      `${ok} placed, ${failed.length} failed, ${results.filter((r) => r.outcome === "Skipped").length} skipped`,
    ),
  );
  return next;
}

export function provisionKey(id: string, dests: Destination[], publish: boolean): RunResult[] {
  const k = state.own.find((x) => x.id === id);
  if (!k) return [];
  const results = dests.map((d) => attempt(k, d));
  updateOwn(id, (cur) => applyResults(cur, results, "Provision PGP Key", publish));
  return results;
}

export function retryFailed(id: string): RunResult[] {
  const k = state.own.find((x) => x.id === id);
  if (!k || !k.failedLocations.length) return [];
  const dests = k.failedLocations.map((f) => ({ host: f.host, osUser: f.osUser, role: f.role }));
  const results = dests.map((d) => attempt(k, d));
  updateOwn(id, (cur) => applyResults(cur, results, "Retry failed locations", false));
  return results;
}

// ─── Own key lifecycle ─────────────────────────────────────────────────────────

export function onboard(id: string, note: string, storeInAppViewX: boolean) {
  updateOwn(id, (k) =>
    logOp(
      {
        ...k,
        management: "Managed",
        storage: storeInAppViewX ? "AppViewX" : k.storage,
        passphrase: storeInAppViewX ? "Entered" : k.passphrase,
        onboarded: { by: CURRENT_USER, at: rel(0), note },
      },
      opNow("Onboard", "Succeeded", note),
    ),
  );
}

export function extendExpiry(ids: string[], scope: "primary" | "subkeys" | "both", days: number) {
  const date = rel(days);
  set({
    own: state.own.map((k) => {
      if (!ids.includes(k.id)) return k;
      const primary =
        scope !== "subkeys" ? { ...k.primary, expires: date, expirySetAt: rel(0) } : k.primary;
      const subkeys =
        scope !== "primary"
          ? k.subkeys.map((s) =>
              s.revoked || s.retiredBy ? s : { ...s, expires: date, expirySetAt: rel(0) },
            )
          : k.subkeys;
      return logOp(
        { ...k, primary, subkeys, publication: outOfDate(k) },
        opNow(
          "Extend Expiry",
          "Succeeded",
          `${scope === "both" ? "Primary key and subkeys" : scope === "primary" ? "Primary key" : "Subkeys"} to ${date}`,
        ),
      );
    }),
  });
}

export function rotateSubkey(id: string, subkeyId: string) {
  updateOwn(id, (k) => {
    const pol = policyFor(k.group, state.policies);
    const old = k.subkeys.find((s) => s.id === subkeyId);
    if (!old) return k;
    const seed = `${k.id}-rot-${Date.now()}`;
    const fresh: Subkey = {
      id: seed,
      fingerprint: makeFingerprint(seed),
      purpose: old.purpose,
      algo: algoForPurpose(pol.rotationAlgorithm, old.purpose),
      created: rel(0),
      expires: rel(pol.rotationValidity),
      expirySetAt: rel(0),
    };
    const subkeys = k.subkeys.map((s) =>
      s.id === subkeyId ? { ...s, retiredBy: "rotate" as const } : s,
    );
    return logOp(
      { ...k, subkeys: [...subkeys, fresh], publication: outOfDate(k) },
      opNow(
        "Rotate Subkey",
        "Succeeded",
        `${old.purpose} subkey replaced, updated on ${k.privateLocations.length + k.publicCopies.length} location(s)`,
      ),
    );
  });
}

export function revokeOwn(
  id: string,
  scope: { kind: "key" } | { kind: "subkey"; subkeyId: string } | { kind: "uid"; index: number },
  reason: string,
  comment: string,
) {
  const rv = { reason, comment: comment || undefined, at: rel(0), by: CURRENT_USER };
  updateOwn(id, (k) => {
    if (scope.kind === "key")
      return logOp(
        { ...k, primary: { ...k.primary, revoked: rv }, publication: outOfDate(k) },
        opNow("Revoke", "Succeeded", `Whole key, ${reason}`),
      );
    if (scope.kind === "subkey")
      return logOp(
        {
          ...k,
          subkeys: k.subkeys.map((s) => (s.id === scope.subkeyId ? { ...s, revoked: rv } : s)),
          publication: outOfDate(k),
        },
        opNow("Revoke", "Succeeded", `Subkey, ${reason}`),
      );
    return logOp(
      {
        ...k,
        userIds: k.userIds.map((u, i) => (i === scope.index ? { ...u, revoked: rv } : u)),
        publication: outOfDate(k),
      },
      opNow("Revoke", "Succeeded", `User ID, ${reason}`),
    );
  });
}

export function createRevCert(id: string) {
  updateOwn(id, (k) =>
    logOp(
      { ...k, revCert: "Stored", revCertWhere: k.storage === "CyberArk" ? "CyberArk" : "AppViewX" },
      opNow("Create Revocation Certificate"),
    ),
  );
}

export function retireOwn(id: string, removeFromHosts: boolean) {
  updateOwn(id, (k) =>
    logOp(
      {
        ...k,
        retired: true,
        subkeys: k.subkeys.map((s) => (isUsable(s) ? { ...s, retiredBy: "retire" as const } : s)),
        privateLocations: removeFromHosts ? [] : k.privateLocations,
        publicCopies: removeFromHosts ? [] : k.publicCopies,
      },
      opNow("Retire", "Succeeded", removeFromHosts ? "Removed from hosts" : "Left on hosts"),
    ),
  );
}

export function reactivate(id: string) {
  updateOwn(id, (k) =>
    logOp(
      {
        ...k,
        retired: false,
        subkeys: k.subkeys.map((s) =>
          s.retiredBy === "retire" ? { ...s, retiredBy: undefined } : s,
        ),
      },
      opNow("Reactivate"),
    ),
  );
}

export function publishOwn(id: string) {
  updateOwn(id, (k) =>
    logOp(
      { ...k, publication: "Published", publishedAt: rel(0) },
      opNow("Publish", "Succeeded", state.settings.keyserver),
    ),
  );
}

export function logOwnOp(id: string, action: string, detail?: string) {
  updateOwn(id, (k) => logOp(k, opNow(action, "Succeeded", detail)));
}

export function deleteOwn(ids: string[], mode: "From Inventory" | "From Hosts") {
  const gone = state.own.filter((k) => ids.includes(k.id));
  const deleted = gone.map((k) => ({ key: k, deletedAt: rel(0), by: CURRENT_USER, mode }));
  set({
    own: state.own.filter((k) => !ids.includes(k.id)),
    deleted: [...deleted, ...state.deleted],
    audit: [
      ...gone.map((k) => ({ ...opNow(`Delete ${mode}`), keyName: keyName(k) })),
      ...state.audit,
    ],
  });
}

// ─── Trusted keys ──────────────────────────────────────────────────────────────

export function lookupKey(query: string) {
  const q = query.trim().toLowerCase();
  return LOOKUP_CATALOG[q] ?? null;
}

export interface ImportInput {
  type: "Partner" | "Repository";
  label: string;
  group: string;
  source: TrustedKey["source"];
  data: { primary: TrustedKey["primary"]; subkeys: Subkey[]; userIds: UserId[] };
  replaces?: string;
}

export function importKey(input: ImportInput): TrustedKey {
  const pol = policyFor(input.group, state.policies);
  const needsApproval = input.type === "Partner" && pol.requireApproval;
  const o = opNow("Import Key", "Succeeded", input.source);
  const key: TrustedKey = {
    id: `tr-${Date.now()}`,
    kind: "trusted",
    type: input.type,
    label: input.label || undefined,
    primary: input.data.primary,
    subkeys: input.data.subkeys,
    userIds: input.data.userIds,
    locations: [],
    approval: needsApproval ? "Pending" : "Approved",
    source: input.source,
    imported: { by: CURRENT_USER, at: rel(0) },
    decision: needsApproval
      ? undefined
      : {
          by: "System",
          at: rel(0),
          note: "Not required by policy",
          decision: "Not required by policy",
        },
    replaces: input.replaces,
    group: input.group,
    history: [o],
  };
  let trusted = [key, ...state.trusted];
  if (input.replaces)
    trusted = trusted.map((k) => (k.id === input.replaces ? { ...k, replacedBy: key.id } : k));
  set({ trusted, audit: [{ ...o, keyName: keyName(key) }, ...state.audit] });
  return key;
}

/** Builds a parsed key from pasted or uploaded armored text. Deterministic on content. */
export function parseArmored(
  text: string,
  fallbackName: string,
): ImportInput["data"] | { error: string } {
  if (!/-----BEGIN PGP PUBLIC KEY BLOCK-----/.test(text)) {
    if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(text))
      return { error: "This is a private key. Only public keys can be imported as trusted keys." };
    return { error: "No PGP public key block found" };
  }
  const seed = `paste-${text.length}-${text.slice(40, 80)}`;
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return {
    primary: {
      fingerprint: makeFingerprint(seed),
      algo: { family: "Ed25519" },
      created: rel(-5),
      expires: rel(725),
      expirySetAt: rel(-5),
      canSign: true,
    },
    subkeys: [
      {
        id: `${seed}-e`,
        fingerprint: makeFingerprint(`${seed}-e`),
        purpose: "Encrypt",
        algo: { family: "Cv25519" },
        created: rel(-5),
        expires: rel(360),
        expirySetAt: rel(-5),
      },
    ],
    userIds: [{ name: fallbackName || "Imported key", email: emailMatch?.[0], primary: true }],
  };
}

export function decide(id: string, decision: "Approved" | "Rejected", note: string) {
  updateTrusted(id, (k) =>
    logOp(
      { ...k, approval: decision, decision: { by: CURRENT_USER, at: rel(0), note, decision } },
      opNow(decision === "Approved" ? "Approve" : "Reject", "Succeeded", note),
    ),
  );
}

export function distribute(id: string, dests: { host: string; osUser: string }[]): RunResult[] {
  const k = state.trusted.find((x) => x.id === id);
  if (!k) return [];
  const results: RunResult[] = dests.map((d) => {
    const dest: Destination = { ...d, role: "Public copy" };
    const h = PGP_HOSTS.find((x) => x.name === d.host);
    if (!h || !h.reachable) return { dest, outcome: "Failed", reason: "Host not reachable" };
    if (!h.users.includes(d.osUser))
      return { dest, outcome: "Failed", reason: `OS user ${d.osUser} does not exist` };
    if (h.readOnlyHome?.includes(d.osUser))
      return { dest, outcome: "Failed", reason: "Keyring not writable" };
    if (k.locations.some((l) => l.host === d.host && l.osUser === d.osUser))
      return { dest, outcome: "Skipped", reason: "Already present" };
    return { dest, outcome: "Succeeded" };
  });
  updateTrusted(id, (cur) => {
    const added = results
      .filter((r) => r.outcome === "Succeeded")
      .map((r) => ({ ...placeLocation(r.dest), inBaseline: undefined }));
    const failed = results.filter((r) => r.outcome === "Failed").length;
    return logOp(
      { ...cur, locations: [...cur.locations, ...added] },
      opNow(
        "Distribute",
        failed ? (added.length ? "Partial" : "Failed") : "Succeeded",
        `${added.length} placed, ${failed} failed`,
      ),
    );
  });
  return results;
}

/** Marks a key already in Trusted Keys as the replacement for an older one. */
export function linkReplacement(oldId: string, newId: string) {
  const old = state.trusted.find((k) => k.id === oldId);
  if (!old) return;
  set({
    trusted: state.trusted.map((k) =>
      k.id === oldId
        ? logOp(
            { ...k, replacedBy: newId },
            opNow("Replace", "Succeeded", "Replacement chosen from Trusted Keys"),
          )
        : k.id === newId
          ? { ...k, replaces: oldId }
          : k,
    ),
  });
}

export function confirmCutover(oldId: string) {
  const old = state.trusted.find((k) => k.id === oldId);
  if (!old) return;
  const o = opNow(
    "Confirm Cutover",
    "Succeeded",
    `Old key removed from ${old.locations.length} location(s)`,
  );
  set({
    trusted: state.trusted
      .filter((k) => k.id !== oldId)
      .map((k) => (k.id === old.replacedBy ? logOp({ ...k, replaces: undefined }, o) : k)),
    deleted: [
      { key: { ...old, locations: [] }, deletedAt: rel(0), by: CURRENT_USER, mode: "Cutover" },
      ...state.deleted,
    ],
  });
}

export function removeTrustedFromHosts(id: string, locs: { host: string; osUser: string }[]) {
  updateTrusted(id, (k) =>
    logOp(
      {
        ...k,
        locations: k.locations.filter(
          (l) => !locs.some((x) => x.host === l.host && x.osUser === l.osUser),
        ),
      },
      opNow("Remove from Hosts", "Succeeded", `${locs.length} location(s)`),
    ),
  );
}

export function logTrustedOp(id: string, action: string, detail?: string) {
  updateTrusted(id, (k) => logOp(k, opNow(action, "Succeeded", detail)));
}

export function deleteTrusted(ids: string[]) {
  const gone = state.trusted.filter((k) => ids.includes(k.id));
  set({
    trusted: state.trusted
      .filter((k) => !ids.includes(k.id))
      .map((k) =>
        k.replacedBy && ids.includes(k.replacedBy) ? { ...k, replacedBy: undefined } : k,
      ),
    deleted: [
      ...gone.map((k) => ({
        key: k,
        deletedAt: rel(0),
        by: CURRENT_USER,
        mode: "From Inventory" as const,
      })),
      ...state.deleted,
    ],
    audit: [
      ...gone.map((k) => ({ ...opNow("Delete From Inventory"), keyName: keyName(k) })),
      ...state.audit,
    ],
  });
}

// ─── Policy, settings, discovery ───────────────────────────────────────────────

/** Creates the policy when it has no id yet, otherwise replaces it. Groups move to this policy. */
export function saveKeyPolicy(p: KeyPolicy): KeyPolicy {
  const saved = p.id ? p : { ...p, id: `pol-${Date.now()}` };
  const others = state.policies
    .filter((x) => x.id !== saved.id)
    .map((x) => ({ ...x, groups: x.groups.filter((g) => !saved.groups.includes(g)) }));
  const exists = state.policies.some((x) => x.id === saved.id);
  set({
    policies: exists
      ? state.policies.map((x) =>
          x.id === saved.id ? saved : (others.find((o) => o.id === x.id) ?? x),
        )
      : [...others, saved],
  });
  return saved;
}

export function deleteKeyPolicies(ids: string[]) {
  const fallback = state.policies.find((x) => x.id === "pol-default");
  const moved = state.policies.filter((x) => ids.includes(x.id)).flatMap((x) => x.groups);
  set({
    policies: state.policies
      .filter((x) => !ids.includes(x.id))
      .map((x) =>
        fallback && x.id === fallback.id
          ? { ...x, groups: [...new Set([...x.groups, ...moved])] }
          : x,
      ),
  });
}

export function saveSettings(s: PgpSettings) {
  set({ settings: s });
}
export function saveDiscovery(d: PgpDiscovery) {
  set({ discovery: d });
}

// ─── Exports ───────────────────────────────────────────────────────────────────

export function armoredPublic(k: PgpKey): string {
  const body = btoa(
    `${k.primary.fingerprint}${k.subkeys.map((s) => s.fingerprint).join("")}`,
  ).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: ${keyName(k)} ${k.primary.fingerprint}\n\n${body}\n=AVX1\n-----END PGP PUBLIC KEY BLOCK-----\n`;
}

export function downloadText(filename: string, text: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "application/pgp-keys" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fileSafe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ─── Discovery ─────────────────────────────────────────────────────────────────

export interface NetworkScanInput {
  mode: "Instant" | "Scheduled";
  name: string;
  startIp: string;
  endIp: string;
  discover: DiscoverTarget[];
  pgpPaths: string[];
  infraGroups: string[];
  keyGroup: string;
  inventoryAction: DiscoveryRun["inventoryAction"];
  frequency: DiscoverySchedule["frequency"];
  time: string;
}

const nowStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Starts a scan now, or saves it as a schedule. Returns the id of the run or schedule. */
export function startNetworkScan(input: NetworkScanInput): string {
  const range = `${input.startIp} - ${input.endIp}`;
  const newGroups = input.infraGroups
    .filter((g) => !state.infraGroups.some((x) => x.name === g))
    .map((g) => ({
      name: g,
      description: "Created from Network Scan",
      hosts: 0,
      createdBy: CURRENT_USER,
    }));
  if (input.discover.includes("PGP Keys"))
    state = { ...state, discovery: { enabled: true, paths: input.pgpPaths } };
  if (input.mode === "Scheduled") {
    const id = `sch-${Date.now()}`;
    const sch: DiscoverySchedule = {
      id,
      name: input.name,
      range,
      frequency: input.frequency,
      time: input.time,
      nextRun: `${rel(1)} ${input.time}`,
      discover: input.discover,
      enabled: true,
      by: CURRENT_USER,
    };
    set({
      schedules: [sch, ...state.schedules],
      infraGroups: [...state.infraGroups, ...newGroups],
    });
    return id;
  }
  const id = `run-${Date.now()}`;
  const size = Math.max(1, (ipToNumber(input.endIp) ?? 0) - (ipToNumber(input.startIp) ?? 0) + 1);
  const run: DiscoveryRun = {
    id,
    name: input.name,
    range,
    startedAt: nowStamp(),
    by: CURRENT_USER,
    mode: "Instant",
    status: "Running",
    discover: input.discover,
    hostsScanned: size,
    hostsReached: 0,
    userKeys: 0,
    hostKeys: 0,
    pgpKeys: 0,
    keyGroup: input.keyGroup,
    inventoryAction: input.inventoryAction,
  };
  set({ runs: [run, ...state.runs], infraGroups: [...state.infraGroups, ...newGroups] });
  setTimeout(() => {
    const reached = Math.max(1, Math.round(size * 0.18));
    set({
      runs: state.runs.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "Completed",
              hostsReached: reached,
              userKeys: input.discover.includes("User Keys") ? reached * 2 : 0,
              hostKeys: input.discover.includes("Host Keys") ? reached : 0,
              pgpKeys: input.discover.includes("PGP Keys") ? Math.round(reached * 0.4) : 0,
            }
          : r,
      ),
    });
  }, 4000);
  return id;
}

export function setScheduleEnabled(id: string, enabled: boolean) {
  set({ schedules: state.schedules.map((x) => (x.id === id ? { ...x, enabled } : x)) });
}

export function deleteSchedules(ids: string[]) {
  set({ schedules: state.schedules.filter((x) => !ids.includes(x.id)) });
}

export function runScheduleNow(id: string) {
  const sch = state.schedules.find((x) => x.id === id);
  if (!sch) return;
  const [startIp, endIp] = sch.range.split(" - ");
  startNetworkScan({
    mode: "Instant",
    name: sch.name,
    startIp,
    endIp,
    discover: sch.discover,
    pgpPaths: state.discovery.paths,
    infraGroups: [],
    keyGroup: "Default_Key_Group",
    inventoryAction: "Manage",
    frequency: sch.frequency,
    time: sch.time,
  });
}

/** Moves a key compliance group to another key policy. */
export function assignGroupPolicy(group: string, policyId: string) {
  set({
    policies: state.policies.map((p) => ({
      ...p,
      groups:
        p.id === policyId
          ? [...new Set([...p.groups, group])]
          : p.groups.filter((g) => g !== group),
    })),
  });
}
