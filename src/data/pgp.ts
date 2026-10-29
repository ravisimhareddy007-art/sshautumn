// PGP key lifecycle: types, policies and seed data.
// All dates are ISO yyyy-MM-dd strings, seeded relative to today so statuses stay meaningful.

export type Purpose = "Sign" | "Encrypt" | "Authenticate";
export type AlgoFamily =
  | "RSA"
  | "Ed25519"
  | "Cv25519"
  | "ECDSA"
  | "ECDH"
  | "DSA"
  | "ElGamal"
  | "Hybrid PQC"
  | "Unknown";
export type Curve = "P-256" | "P-384" | "P-521";

export interface PgpAlgo {
  family: AlgoFamily;
  size?: number;
  curve?: Curve;
}

export interface Revocation {
  reason: string;
  comment?: string;
  at: string;
  by: string;
}

export interface PrimaryKey {
  fingerprint: string;
  algo: PgpAlgo;
  created: string;
  expires: string | null;
  /** Date the current expiry was last set; validity is measured from here. */
  expirySetAt: string;
  canSign: boolean;
  revoked?: Revocation;
  v3?: boolean;
}

export interface Subkey {
  id: string;
  fingerprint: string;
  purpose: Purpose;
  algo: PgpAlgo;
  created: string;
  expires: string | null;
  expirySetAt: string;
  revoked?: Revocation;
  /** Set when AVX SSH ended the subkey through Rotate Subkey or Retire. */
  retiredBy?: "rotate" | "retire";
}

export interface UserId {
  name: string;
  email?: string;
  comment?: string;
  primary: boolean;
  revoked?: Revocation;
}

export type KeyringType = "GnuPG keyring" | "Key file" | "apt" | "rpm";

export interface PgpLocation {
  host: string;
  osUser: string;
  path: string;
  keyring: KeyringType;
  heldIn?: "Host keyring" | "Smart card";
  read: "Read" | "Inaccessible";
  inaccessibleReason?: string;
  lastDiscovered: string;
  placedBy?: "AVX SSH" | "Discovery";
  /** Own keys only: whether this location was part of the host's PGP baseline. */
  inBaseline?: boolean;
  /** Own keys only: why the private key here is misplaced. */
  misplaced?: string;
}

export interface GitRef {
  host: string;
  osUser: string;
  level: "user" | "system";
}

export interface Operation {
  action: string;
  user: string;
  at: string;
  outcome: "Succeeded" | "Failed" | "Partial";
  detail?: string;
}

export interface FailedLocation {
  host: string;
  osUser: string;
  role: "Private key" | "Public copy";
  reason: string;
}

export interface OwnKey {
  id: string;
  kind: "own";
  primary: PrimaryKey;
  subkeys: Subkey[];
  userIds: UserId[];
  privateLocations: PgpLocation[];
  publicCopies: PgpLocation[];
  management: "Managed" | "Discovered";
  storage: "AppViewX" | "CyberArk" | "Host only";
  group: string;
  retired?: boolean;
  revCert: "Stored" | "Missing";
  revCertWhere?: "AppViewX" | "CyberArk";
  publication: "Published" | "Out of date" | "Not published";
  publishedAt?: string;
  gitRefs: GitRef[];
  linkedSshKeyId?: string;
  orphaned?: boolean;
  /** True for a key AVX SSH generated whose locations have never been placed. */
  notProvisioned?: boolean;
  generated?: { by: string; at: string };
  onboarded?: { by: string; at: string; note: string };
  passphrase: "Generated" | "Entered" | "Unknown";
  vault?: VaultConfig;
  tags: string[];
  lastOperation?: Operation;
  lastDiscovered?: string;
  failedLocations: FailedLocation[];
  history: Operation[];
}

export type Approval = "Approved" | "Pending" | "Not approved" | "Rejected";

export interface TrustedKey {
  id: string;
  kind: "trusted";
  type: "Partner" | "Repository";
  label?: string;
  primary: PrimaryKey;
  subkeys: Subkey[];
  userIds: UserId[];
  locations: PgpLocation[];
  /** Partner keys only; repository approval comes from policy. */
  approval: Approval;
  source: "File" | "Paste" | "Keyserver" | "Web Key Directory" | "Discovered";
  imported?: { by: string; at: string };
  decision?: {
    by: string;
    at: string;
    note: string;
    decision: "Approved" | "Rejected" | "Not required by policy";
  };
  policyCheck?: string[];
  replaces?: string;
  replacedBy?: string;
  repoManager?: "apt" | "rpm";
  group: string;
  lastDiscovered?: string;
  history: Operation[];
}

export type PgpKey = OwnKey | TrustedKey;

export interface VaultConfig {
  vendor: "CyberArk";
  vaultConfig: string;
  safeName: string;
  userName: string;
  pamAccountName: string;
  serverAddress: string;
}

export interface PgpPolicy {
  id: string;
  name: string;
  evaluate: boolean;
  rsaMin: 2048 | 3072 | 4096 | null;
  ed25519: boolean;
  ecdsaCurves: Curve[];
  maxValidityPrimary: number | null;
  maxValiditySubkeys: number | null;
  expiringThreshold: number;
  expiryRequired: boolean;
  revCertRequired: boolean;
  requiredSubkeys: Purpose[];
  rotationAlgorithm: string;
  rotationValidity: number;
  allowedRisks: string[];
  requireApproval: boolean;
  approvedRepoKeys: { fingerprint: string; label: string }[];
  cyberArk?: {
    required: boolean;
    vaultConfig: string;
    safeName: string;
    userName: string;
    pamFormat: string;
    serverAddress: string;
  };
}

export interface DeletedPgpKey {
  key: PgpKey;
  deletedAt: string;
  by: string;
  mode: "From Inventory" | "From Hosts" | "Cutover";
}

export interface PgpHost {
  name: string;
  users: string[];
  gnupg: string | null;
  reachable: boolean;
  /** Fails the first run, succeeds on retry. Demonstrates per-location retry. */
  flaky?: boolean;
  readOnlyHome?: string[];
}

export const CURRENT_USER = "admin";

export const PGP_GROUPS = ["Default", "Prod_Group", "Service_Group", "Finance_Keys"];

export const GROUP_POLICY: Record<string, string> = {
  Default: "pol-default",
  Prod_Group: "pol-default",
  Service_Group: "pol-default",
  Finance_Keys: "pol-finance",
};

// ─── Dates ─────────────────────────────────────────────────────────────────────

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function rel(days: number): string {
  const d = today();
  d.setDate(d.getDate() + days);
  return iso(d);
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}
export function daysFromToday(s: string): number {
  return daysBetween(iso(today()), s);
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = parseIso(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Fingerprints ──────────────────────────────────────────────────────────────

const HEX = "0123456789ABCDEF";
export function makeFingerprint(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 40; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out += HEX[(x >>> 16) & 15];
  }
  return out;
}
export const keyIdOf = (fp: string) => fp.slice(-16);
export const shortFp = (fp: string) => `${fp.slice(0, 4)}…${fp.slice(-4)}`;
export const groupedFp = (fp: string) => fp.replace(/(.{4})/g, "$1 ").trim();

// ─── Hosts available to provisioning and distribution ──────────────────────────

export const PGP_HOSTS: PgpHost[] = [
  { name: "sftp-gw-01", users: ["sftp-svc", "root"], gnupg: "2.4.4", reachable: true },
  { name: "sftp-gw-02", users: ["sftp-svc", "root"], gnupg: "2.4.4", reachable: true },
  { name: "recon-01", users: ["recon", "root"], gnupg: "2.2.40", reachable: true },
  { name: "build-01", users: ["build", "root"], gnupg: "2.4.5", reachable: true },
  { name: "backup-01", users: ["backup", "root"], gnupg: "2.2.27", reachable: true },
  { name: "dr-sftp-01", users: ["sftp-svc", "root"], gnupg: "2.4.4", reachable: true, flaky: true },
  { name: "legacy-01", users: ["recon", "root"], gnupg: "1.4.23", reachable: true },
  {
    name: "ftp-in-02",
    users: ["ftpuser", "root"],
    gnupg: "2.2.19",
    reachable: true,
    readOnlyHome: ["ftpuser"],
  },
  { name: "old-batch-02", users: ["batch"], gnupg: "2.2.12", reachable: false },
];

// ─── Policies ──────────────────────────────────────────────────────────────────

export const SEED_POLICIES: PgpPolicy[] = [
  {
    id: "pol-default",
    name: "Default_Key_Policy",
    evaluate: true,
    rsaMin: 3072,
    ed25519: true,
    ecdsaCurves: [],
    maxValidityPrimary: 1095,
    maxValiditySubkeys: 365,
    expiringThreshold: 30,
    expiryRequired: false,
    revCertRequired: true,
    requiredSubkeys: ["Encrypt"],
    rotationAlgorithm: "Ed25519",
    rotationValidity: 365,
    allowedRisks: ["Expiring"],
    requireApproval: true,
    approvedRepoKeys: [],
    cyberArk: {
      required: false,
      vaultConfig: "CyberArk-Prod",
      safeName: "PGP-Keys-Prod",
      userName: "appviewx",
      pamFormat: "pgp-{key name}",
      serverAddress: "vault.harborbank.example",
    },
  },
  {
    id: "pol-finance",
    name: "Finance_Key_Policy",
    evaluate: true,
    rsaMin: 4096,
    ed25519: true,
    ecdsaCurves: [],
    maxValidityPrimary: 730,
    maxValiditySubkeys: 365,
    expiringThreshold: 30,
    expiryRequired: true,
    revCertRequired: true,
    requiredSubkeys: ["Encrypt", "Sign"],
    rotationAlgorithm: "Ed25519",
    rotationValidity: 365,
    allowedRisks: ["Expiring", "Shared"],
    requireApproval: true,
    approvedRepoKeys: [],
    cyberArk: {
      required: true,
      vaultConfig: "CyberArk-Prod",
      safeName: "PGP-Finance-Prod",
      userName: "sftp-svc",
      pamFormat: "pgp-{key name}",
      serverAddress: "vault.harborbank.example",
    },
  },
];

// ─── Seed data ─────────────────────────────────────────────────────────────────

const ed = (): PgpAlgo => ({ family: "Ed25519" });
const cv = (): PgpAlgo => ({ family: "Cv25519" });
const rsa = (size: number): PgpAlgo => ({ family: "RSA", size });

function sub(
  seed: string,
  purpose: Purpose,
  algo: PgpAlgo,
  created: number,
  expires: number | null,
  extra: Partial<Subkey> = {},
): Subkey {
  const fp = makeFingerprint(seed);
  return {
    id: `${seed}`,
    fingerprint: fp,
    purpose,
    algo,
    created: rel(created),
    expires: expires === null ? null : rel(expires),
    expirySetAt: rel(Math.max(created, -300)),
    ...extra,
  };
}

function loc(
  host: string,
  osUser: string,
  path: string,
  extra: Partial<PgpLocation> = {},
): PgpLocation {
  return {
    host,
    osUser,
    path,
    keyring: "GnuPG keyring",
    heldIn: "Host keyring",
    read: "Read",
    lastDiscovered: rel(-1),
    placedBy: "Discovery",
    inBaseline: true,
    ...extra,
  };
}

function op(
  action: string,
  daysAgo: number,
  user = CURRENT_USER,
  outcome: Operation["outcome"] = "Succeeded",
  detail?: string,
): Operation {
  return { action, user, at: rel(-daysAgo), outcome, detail };
}

const ownSeed: OwnKey[] = [
  {
    id: "own-sftp",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-sftp"),
      algo: ed(),
      created: rel(-400),
      expires: rel(330),
      expirySetAt: rel(-35),
      canSign: true,
    },
    subkeys: [
      sub("own-sftp-e", "Encrypt", cv(), -400, 22),
      sub("own-sftp-s", "Sign", ed(), -400, 300, { expirySetAt: rel(-35) }),
      sub("own-sftp-a", "Authenticate", ed(), -400, 300, { expirySetAt: rel(-35) }),
    ],
    userIds: [{ name: "Harbor Bank SFTP", email: "sftp-ops@harborbank.example", primary: true }],
    privateLocations: [
      loc("sftp-gw-01", "sftp-svc", "/home/sftp-svc/.gnupg", { placedBy: "AVX SSH" }),
      loc("sftp-gw-02", "sftp-svc", "/home/sftp-svc/.gnupg", { placedBy: "AVX SSH" }),
    ],
    publicCopies: [loc("recon-01", "recon", "/home/recon/.gnupg", { placedBy: "AVX SSH" })],
    management: "Managed",
    storage: "CyberArk",
    group: "Finance_Keys",
    revCert: "Stored",
    revCertWhere: "CyberArk",
    publication: "Published",
    publishedAt: rel(-35),
    gitRefs: [],
    linkedSshKeyId: "uk2",
    generated: { by: "sam.ops", at: rel(-400) },
    passphrase: "Generated",
    vault: {
      vendor: "CyberArk",
      vaultConfig: "CyberArk-Prod",
      safeName: "PGP-Finance-Prod",
      userName: "sftp-svc",
      pamAccountName: "pgp-harbor-bank-sftp",
      serverAddress: "vault.harborbank.example",
    },
    tags: ["sftp", "partner-exchange"],
    lastOperation: op("Extend Expiry", 35, "sam.ops"),
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [
      op("Generate PGP Key", 400, "sam.ops"),
      op("Provision PGP Key", 399, "sam.ops"),
      op("Publish", 35, "sam.ops"),
      op("Extend Expiry", 35, "sam.ops"),
    ],
  },
  {
    id: "own-release",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-release"),
      algo: rsa(4096),
      created: rel(-500),
      expires: rel(600),
      expirySetAt: rel(-120),
      canSign: true,
    },
    subkeys: [sub("own-release-s", "Sign", rsa(4096), -500, 245, { expirySetAt: rel(-120) })],
    userIds: [
      { name: "Harbor Bank Release Signing", email: "release@harborbank.example", primary: true },
    ],
    privateLocations: [loc("build-01", "build", "/home/build/.gnupg", { placedBy: "AVX SSH" })],
    publicCopies: [],
    management: "Managed",
    storage: "AppViewX",
    group: "Default",
    revCert: "Stored",
    revCertWhere: "AppViewX",
    publication: "Published",
    publishedAt: rel(-120),
    gitRefs: [{ host: "build-01", osUser: "build", level: "user" }],
    generated: { by: "sam.ops", at: rel(-500) },
    passphrase: "Generated",
    tags: ["release"],
    lastOperation: op("Publish", 120, "sam.ops"),
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [
      op("Generate PGP Key", 500, "sam.ops"),
      op("Provision PGP Key", 500, "sam.ops"),
      op("Publish", 120, "sam.ops"),
    ],
  },
  {
    id: "own-treasury",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-treasury"),
      algo: ed(),
      created: rel(-240),
      expires: rel(490),
      expirySetAt: rel(-240),
      canSign: true,
    },
    subkeys: [sub("own-treasury-e", "Encrypt", cv(), -240, 110)],
    userIds: [{ name: "Treasury Team", email: "treasury@harborbank.example", primary: true }],
    privateLocations: [loc("fin-app-03", "treasury", "/home/treasury/.gnupg")],
    publicCopies: [],
    management: "Discovered",
    storage: "Host only",
    group: "Prod_Group",
    revCert: "Missing",
    publication: "Not published",
    gitRefs: [],
    passphrase: "Unknown",
    tags: [],
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [],
  },
  {
    id: "own-backup",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-backup"),
      algo: rsa(3072),
      created: rel(-1300),
      expires: rel(430),
      expirySetAt: rel(-300),
      canSign: true,
    },
    subkeys: [sub("own-backup-e", "Encrypt", rsa(3072), -1300, -60, { retiredBy: "retire" })],
    userIds: [{ name: "Backup Archive 2019", email: "backup@harborbank.example", primary: true }],
    privateLocations: [loc("backup-01", "backup", "/home/backup/.gnupg", { placedBy: "AVX SSH" })],
    publicCopies: [],
    management: "Managed",
    storage: "AppViewX",
    group: "Default",
    retired: true,
    revCert: "Stored",
    revCertWhere: "AppViewX",
    publication: "Not published",
    gitRefs: [],
    generated: { by: "sam.ops", at: rel(-1300) },
    passphrase: "Generated",
    tags: ["backup"],
    lastOperation: op("Retire", 60, "sam.ops"),
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [op("Generate PGP Key", 1300, "sam.ops"), op("Retire", 60, "sam.ops")],
  },
  {
    id: "own-oldftp",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-oldftp"),
      algo: { family: "DSA", size: 1024 },
      created: rel(-2900),
      expires: rel(-200),
      expirySetAt: rel(-2900),
      canSign: true,
    },
    subkeys: [sub("own-oldftp-e", "Encrypt", { family: "ElGamal", size: 2048 }, -2900, -200)],
    userIds: [{ name: "old-ftp-key", primary: true }],
    privateLocations: [
      loc("legacy-ftp-01", "root", "/opt/transfer/keys/old-ftp.sec", {
        keyring: "Key file",
        misplaced: "Outside a GnuPG home, readable by other users",
      }),
    ],
    publicCopies: [],
    management: "Discovered",
    storage: "Host only",
    group: "Default",
    revCert: "Missing",
    publication: "Not published",
    gitRefs: [],
    passphrase: "Unknown",
    tags: [],
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [],
  },
  {
    id: "own-devsign",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-devsign"),
      algo: rsa(4096),
      created: rel(-26),
      expires: rel(180),
      expirySetAt: rel(-26),
      canSign: true,
    },
    subkeys: [],
    userIds: [{ name: "dev-sign", email: "dev@harborbank.example", primary: true }],
    privateLocations: [loc("dev-box-07", "jdoe", "/home/jdoe/.gnupg", { inBaseline: false })],
    publicCopies: [],
    management: "Discovered",
    storage: "Host only",
    group: "Default",
    revCert: "Missing",
    publication: "Not published",
    gitRefs: [{ host: "dev-box-07", osUser: "jdoe", level: "user" }],
    passphrase: "Unknown",
    tags: [],
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [],
  },
  {
    id: "own-settlement",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-settlement"),
      algo: ed(),
      created: rel(-1),
      expires: rel(729),
      expirySetAt: rel(-1),
      canSign: true,
    },
    subkeys: [
      sub("own-settlement-e", "Encrypt", cv(), -1, 364, { expirySetAt: rel(-1) }),
      sub("own-settlement-s", "Sign", ed(), -1, 364, { expirySetAt: rel(-1) }),
    ],
    userIds: [
      {
        name: "Harbor Bank Settlement",
        email: "settlement@harborbank.example",
        comment: "ClearCard settlement files",
        primary: true,
      },
    ],
    privateLocations: [],
    publicCopies: [],
    management: "Managed",
    storage: "CyberArk",
    group: "Finance_Keys",
    revCert: "Stored",
    revCertWhere: "CyberArk",
    publication: "Not published",
    gitRefs: [],
    notProvisioned: true,
    generated: { by: CURRENT_USER, at: rel(-1) },
    passphrase: "Generated",
    vault: {
      vendor: "CyberArk",
      vaultConfig: "CyberArk-Prod",
      safeName: "PGP-Finance-Prod",
      userName: "sftp-svc",
      pamAccountName: "pgp-harbor-bank-settlement",
      serverAddress: "vault.harborbank.example",
    },
    tags: ["clearcard"],
    lastOperation: op("Generate PGP Key", 1),
    failedLocations: [],
    history: [op("Generate PGP Key", 1)],
  },
  {
    id: "own-smartcard",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-smartcard"),
      algo: rsa(4096),
      created: rel(-700),
      expires: null,
      expirySetAt: rel(-700),
      canSign: true,
    },
    subkeys: [sub("own-smartcard-e", "Encrypt", rsa(4096), -700, 300, { expirySetAt: rel(-65) })],
    userIds: [
      { name: "Payments Operations", email: "payments-ops@harborbank.example", primary: true },
    ],
    privateLocations: [
      loc("ops-ws-02", "payops", "/home/payops/.gnupg", { heldIn: "Smart card" }),
      loc("ops-ws-03", "payops", "/home/payops/.gnupg", { heldIn: "Smart card" }),
    ],
    publicCopies: [],
    management: "Managed",
    storage: "Host only",
    group: "Prod_Group",
    revCert: "Stored",
    revCertWhere: "AppViewX",
    publication: "Published",
    publishedAt: rel(-65),
    gitRefs: [],
    onboarded: {
      by: "sam.ops",
      at: rel(-90),
      note: "Hardware token issued to payments ops, verified with team lead",
    },
    passphrase: "Unknown",
    tags: ["smart-card"],
    lastOperation: op("Onboard", 90, "sam.ops"),
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [op("Onboard", 90, "sam.ops"), op("Create Revocation Certificate", 89, "sam.ops")],
  },
  {
    id: "own-ciorphan",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-ciorphan"),
      algo: rsa(2048),
      created: rel(-410),
      expires: rel(320),
      expirySetAt: rel(-410),
      canSign: true,
    },
    subkeys: [sub("own-ciorphan-e", "Encrypt", rsa(2048), -410, 320)],
    userIds: [{ name: "ci-deploy", email: "ci@harborbank.example", primary: true }],
    privateLocations: [
      loc("ci-runner-04", "ci", "/home/ci/.gnupg"),
      loc("ci-runner-05", "ci", "/home/ci/.gnupg", {
        read: "Inaccessible",
        inaccessibleReason: "Permission denied reading pubring.kbx",
      }),
    ],
    publicCopies: [],
    management: "Discovered",
    storage: "Host only",
    group: "Service_Group",
    revCert: "Missing",
    publication: "Not published",
    gitRefs: [],
    orphaned: true,
    passphrase: "Unknown",
    tags: [],
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [],
  },
  {
    id: "own-oldpayroll",
    kind: "own",
    primary: {
      fingerprint: makeFingerprint("own-oldpayroll"),
      algo: rsa(3072),
      created: rel(-900),
      expires: rel(200),
      expirySetAt: rel(-400),
      canSign: true,
      revoked: {
        reason: "Key superseded",
        at: rel(-15),
        by: "sam.ops",
        comment: "Replaced by the 2026 payroll key",
      },
    },
    subkeys: [sub("own-oldpayroll-e", "Encrypt", rsa(3072), -900, 200)],
    userIds: [{ name: "Old Payroll Key", email: "payroll@harborbank.example", primary: true }],
    privateLocations: [
      loc("payroll-01", "payroll", "/home/payroll/.gnupg", { placedBy: "AVX SSH" }),
    ],
    publicCopies: [],
    management: "Managed",
    storage: "AppViewX",
    group: "Default",
    revCert: "Stored",
    revCertWhere: "AppViewX",
    publication: "Out of date",
    publishedAt: rel(-400),
    gitRefs: [],
    generated: { by: "sam.ops", at: rel(-900) },
    passphrase: "Generated",
    tags: ["payroll"],
    lastOperation: op("Revoke", 15, "sam.ops"),
    lastDiscovered: rel(-1),
    failedLocations: [],
    history: [
      op("Generate PGP Key", 900, "sam.ops"),
      op("Revoke", 15, "sam.ops", "Succeeded", "Whole key, Key superseded"),
    ],
  },
];

const repoHosts = (n: number, manager: "apt" | "rpm"): PgpLocation[] =>
  Array.from({ length: n }, (_, i) =>
    loc(
      `app-${String(i + 1).padStart(2, "0")}`,
      "root",
      manager === "apt" ? "/etc/apt/trusted.gpg.d" : "/etc/pki/rpm-gpg",
      {
        keyring: manager,
        heldIn: undefined,
        inBaseline: undefined,
      },
    ),
  );

const trustedSeed: TrustedKey[] = [
  {
    id: "tr-paywise",
    kind: "trusted",
    type: "Partner",
    label: "PayWise Payroll",
    primary: {
      fingerprint: makeFingerprint("tr-paywise"),
      algo: rsa(4096),
      created: rel(-300),
      expires: rel(420),
      expirySetAt: rel(-300),
      canSign: true,
    },
    subkeys: [sub("tr-paywise-e", "Encrypt", rsa(4096), -300, 120)],
    userIds: [{ name: "PayWise File Exchange", email: "files@paywise.example", primary: true }],
    locations: [
      loc("sftp-gw-01", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
      loc("sftp-gw-02", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
    ],
    approval: "Approved",
    source: "Keyserver",
    imported: { by: "sam.ops", at: rel(-120) },
    decision: {
      by: "priya.sec",
      at: rel(-119),
      note: "Fingerprint confirmed by phone with the PayWise security team",
      decision: "Approved",
    },
    group: "Finance_Keys",
    lastDiscovered: rel(-1),
    history: [
      op("Import Key", 120, "sam.ops"),
      op("Approve", 119, "priya.sec"),
      op("Distribute", 119, "sam.ops"),
    ],
  },
  {
    id: "tr-clearcard",
    kind: "trusted",
    type: "Partner",
    label: "ClearCard Settlement",
    primary: {
      fingerprint: makeFingerprint("tr-clearcard"),
      algo: ed(),
      created: rel(-340),
      expires: rel(25),
      expirySetAt: rel(-340),
      canSign: true,
    },
    subkeys: [sub("tr-clearcard-e", "Encrypt", cv(), -340, 25)],
    userIds: [
      { name: "ClearCard Settlement", email: "settlement@clearcard.example", primary: true },
    ],
    locations: [
      loc("sftp-gw-01", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
      loc("sftp-gw-02", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
    ],
    approval: "Approved",
    source: "File",
    imported: { by: "sam.ops", at: rel(-340) },
    decision: {
      by: "priya.sec",
      at: rel(-339),
      note: "Fingerprint read out on a call with ClearCard operations",
      decision: "Approved",
    },
    group: "Finance_Keys",
    lastDiscovered: rel(-1),
    history: [
      op("Import Key", 340, "sam.ops"),
      op("Approve", 339, "priya.sec"),
      op("Distribute", 339, "sam.ops"),
    ],
  },
  {
    id: "tr-clearcard27",
    kind: "trusted",
    type: "Partner",
    label: "ClearCard Settlement 2027",
    primary: {
      fingerprint: makeFingerprint("tr-clearcard27"),
      algo: ed(),
      created: rel(-3),
      expires: rel(760),
      expirySetAt: rel(-3),
      canSign: true,
    },
    subkeys: [sub("tr-clearcard27-e", "Encrypt", cv(), -3, 760)],
    userIds: [
      { name: "ClearCard Settlement", email: "settlement@clearcard.example", primary: true },
    ],
    locations: [],
    approval: "Pending",
    source: "File",
    imported: { by: "sam.ops", at: rel(-2) },
    policyCheck: ["Algorithm Ed25519: allowed", "Expiry set: yes", "Not revoked"],
    group: "Finance_Keys",
    history: [op("Import Key", 2, "sam.ops")],
  },
  {
    id: "tr-metro",
    kind: "trusted",
    type: "Partner",
    label: "Metro Clearing House",
    primary: {
      fingerprint: makeFingerprint("tr-metro"),
      algo: rsa(3072),
      created: rel(-760),
      expires: rel(-20),
      expirySetAt: rel(-760),
      canSign: true,
    },
    subkeys: [sub("tr-metro-e", "Encrypt", rsa(3072), -760, -20)],
    userIds: [{ name: "Metro Clearing House", email: "pgp@metroclearing.example", primary: true }],
    locations: [
      loc("sftp-gw-01", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
    ],
    approval: "Approved",
    source: "Keyserver",
    imported: { by: "sam.ops", at: rel(-700) },
    decision: {
      by: "priya.sec",
      at: rel(-699),
      note: "Confirmed against Metro's published fingerprint letter",
      decision: "Approved",
    },
    group: "Finance_Keys",
    lastDiscovered: rel(-1),
    history: [op("Import Key", 700, "sam.ops"), op("Approve", 699, "priya.sec")],
  },
  {
    id: "tr-vendorx",
    kind: "trusted",
    type: "Partner",
    primary: {
      fingerprint: makeFingerprint("tr-vendorx"),
      algo: rsa(2048),
      created: rel(-180),
      expires: rel(550),
      expirySetAt: rel(-180),
      canSign: true,
    },
    subkeys: [sub("tr-vendorx-e", "Encrypt", rsa(2048), -180, 550)],
    userIds: [{ name: "Vendor X Files", email: "files@vendorx.example", primary: true }],
    locations: [loc("ftp-in-02", "ftpuser", "/home/ftpuser/.gnupg", { inBaseline: undefined })],
    approval: "Not approved",
    source: "Discovered",
    group: "Default",
    lastDiscovered: rel(-1),
    history: [],
  },
  {
    id: "tr-osvendor",
    kind: "trusted",
    type: "Repository",
    label: "OS Vendor Archive Signing Key",
    primary: {
      fingerprint: makeFingerprint("tr-osvendor"),
      algo: rsa(4096),
      created: rel(-2000),
      expires: null,
      expirySetAt: rel(-2000),
      canSign: true,
    },
    subkeys: [],
    userIds: [
      {
        name: "OS Vendor Archive Automatic Signing Key",
        email: "archive@osvendor.example",
        primary: true,
      },
    ],
    locations: repoHosts(42, "apt"),
    approval: "Approved",
    source: "Discovered",
    repoManager: "apt",
    group: "Default",
    lastDiscovered: rel(-1),
    history: [],
  },
  {
    id: "tr-monitoring",
    kind: "trusted",
    type: "Repository",
    label: "Monitoring Agent Repo Key",
    primary: {
      fingerprint: makeFingerprint("tr-monitoring"),
      algo: rsa(4096),
      created: rel(-290),
      expires: rel(75),
      expirySetAt: rel(-290),
      canSign: true,
    },
    subkeys: [],
    userIds: [
      { name: "Monitoring Agent Packages", email: "packages@monitoring.example", primary: true },
    ],
    locations: repoHosts(3, "rpm"),
    approval: "Approved",
    source: "Discovered",
    repoManager: "rpm",
    group: "Default",
    lastDiscovered: rel(-1),
    history: [],
  },
  {
    id: "tr-oldbank",
    kind: "trusted",
    type: "Partner",
    label: "Northline Bank 2022",
    primary: {
      fingerprint: makeFingerprint("tr-oldbank"),
      algo: rsa(2048),
      created: rel(-1200),
      expires: rel(90),
      expirySetAt: rel(-1200),
      canSign: true,
      revoked: { reason: "Key superseded", at: rel(-40), by: "Northline Bank" },
    },
    subkeys: [sub("tr-oldbank-e", "Encrypt", rsa(2048), -1200, 90)],
    userIds: [
      { name: "Northline Bank Transfers", email: "transfers@northline.example", primary: true },
    ],
    locations: [
      loc("sftp-gw-02", "sftp-svc", "/home/sftp-svc/.gnupg", {
        placedBy: "AVX SSH",
        inBaseline: undefined,
      }),
    ],
    approval: "Approved",
    source: "Keyserver",
    imported: { by: "sam.ops", at: rel(-1100) },
    decision: { by: "priya.sec", at: rel(-1099), note: "Confirmed by phone", decision: "Approved" },
    group: "Finance_Keys",
    lastDiscovered: rel(-1),
    history: [op("Import Key", 1100, "sam.ops"), op("Approve", 1099, "priya.sec")],
  },
];

// The OS vendor key is on the default policy's approved list.
SEED_POLICIES[0].approvedRepoKeys = [
  { fingerprint: makeFingerprint("tr-osvendor"), label: "OS Vendor Archive Signing Key" },
];

export const SEED_OWN_KEYS = ownSeed;
export const SEED_TRUSTED_KEYS = trustedSeed;

/** Keys a keyserver or Web Key Directory lookup can return during Import Key. */
export const LOOKUP_CATALOG: Record<
  string,
  Omit<
    TrustedKey,
    "id" | "kind" | "approval" | "source" | "group" | "history" | "locations" | "type"
  >
> = {
  "files@novapay.example": {
    primary: {
      fingerprint: makeFingerprint("lookup-novapay"),
      algo: rsa(4096),
      created: rel(-10),
      expires: rel(720),
      expirySetAt: rel(-10),
      canSign: true,
    },
    subkeys: [sub("lookup-novapay-e", "Encrypt", rsa(4096), -10, 365)],
    userIds: [{ name: "NovaPay File Exchange", email: "files@novapay.example", primary: true }],
  },
  "ops@legacy-partner.example": {
    primary: {
      fingerprint: makeFingerprint("lookup-legacy"),
      algo: { family: "DSA", size: 1024 },
      created: rel(-3000),
      expires: null,
      expirySetAt: rel(-3000),
      canSign: true,
    },
    subkeys: [sub("lookup-legacy-e", "Encrypt", { family: "ElGamal", size: 2048 }, -3000, null)],
    userIds: [{ name: "Legacy Partner Ops", email: "ops@legacy-partner.example", primary: true }],
  },
};
