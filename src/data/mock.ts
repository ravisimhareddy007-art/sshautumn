// Mock data for AVX SSH prototype

export type RiskStatus = "None" | "Suspicious" | "Rogue" | "Misplaced" | "Weak" | "Shared";
export type KeyCombination = "private_public" | "private_cert" | "public_cert" | "private_only" | "public_only";
export type ComplianceStatus = "Compliant" | "Non-Compliant";
export type KeyStatus = "Active" | "Inactive" | "Revoked";
export type CertStatus = "Active" | "Expired" | "Revoked";

// ─── Key algorithms ───────────────────────────────────────────────────────────
// Single definition shared by Key Policy, discovery, inventory and provisioning.
export type KeyEncryption = "ED25519" | "RSA" | "ECDSA" | "MLDSA44-ED25519" | "MLDSA87-P384" | "Unknown";
export type AlgorithmFamily = "Classical" | "Hybrid post-quantum";

export interface AlgoDef {
  display: KeyEncryption;
  standardId: string;         // SSHM working group identifier
  opensshId?: string;         // current OpenSSH implementation identifier
  family: AlgorithmFamily;
  canGenerate: boolean;
  hasLength: boolean;
  // Derived aliases so existing pages can keep reading the richer detail.
  canonical?: string;
  components?: string;
  support?: string;
}

export const ALGO_DEFS: AlgoDef[] = [
  { display: "ED25519", standardId: "ssh-ed25519", opensshId: "ssh-ed25519", family: "Classical", canGenerate: true, hasLength: true },
  { display: "ECDSA", standardId: "ecdsa-sha2-nistp256", opensshId: "ecdsa-sha2-nistp256", family: "Classical", canGenerate: true, hasLength: true },
  { display: "RSA", standardId: "rsa-sha2-256", opensshId: "rsa-sha2-256", family: "Classical", canGenerate: true, hasLength: true },
  { display: "MLDSA44-ED25519", standardId: "ssh-mldsa44-ed25519", opensshId: "ssh-mldsa44-ed25519@openssh.com", family: "Hybrid post-quantum", canGenerate: true, hasLength: false },
  { display: "MLDSA87-P384", standardId: "ssh-mldsa87-p384", family: "Hybrid post-quantum", canGenerate: false, hasLength: false },
];


// Populates the derived aliases from the standard identifiers above.
const ALGO_DETAIL: Record<KeyEncryption, { canonical: string; components: string; support: string }> = {
  ED25519: { canonical: "ssh-ed25519", components: "Ed25519", support: "Supported since OpenSSH 6.5" },
  ECDSA: { canonical: "ecdsa-sha2-nistp256", components: "ECDSA", support: "Supported since OpenSSH 5.7" },
  RSA: { canonical: "rsa-sha2-256", components: "RSA", support: "Supported since OpenSSH 7.2" },
  "MLDSA44-ED25519": { canonical: "ssh-mldsa44-ed25519", components: "ML-DSA-44 with Ed25519", support: "Usable on OpenSSH 10.4 and above" },
  "MLDSA87-P384": { canonical: "ssh-mldsa87-p384", components: "ML-DSA-87 with ECDSA P-384", support: "Not yet available in any OpenSSH version" },
  Unknown: { canonical: "", components: "", support: "" },
};
for (const a of ALGO_DEFS) Object.assign(a, ALGO_DETAIL[a.display]);

export const HYBRID_ALGOS = ALGO_DEFS.filter((a) => a.family === "Hybrid post-quantum");
export const algoDef = (e: KeyEncryption): AlgoDef | undefined => ALGO_DEFS.find((a) => a.display === e);
export const isHybridKey = (e: KeyEncryption): boolean => algoDef(e)?.family === "Hybrid post-quantum";
export const algoFamily = (e: KeyEncryption): AlgorithmFamily => algoDef(e)?.family ?? "Classical";

export type MigrationStatus = "in_coexistence" | "awaiting_confirmation" | "decommissioned" | "rolled_back";

export interface SshKey {
  id: string;
  name: string;
  type: "user" | "host";
  encryption: KeyEncryption;
  length: number; // 0 when the algorithm has no key size
  rawAlgorithm?: string; // raw value when the algorithm is not recognised
  age: string;
  associatedUsers: string[];
  clientEndpoints: string[];
  hostEndpoints: string[];
  fingerprint: string;
  status: KeyStatus;
  riskStatus: RiskStatus;
  complianceStatus: ComplianceStatus;
  filePaths: string[];
  comment: string;
  keyComplianceGroup: string;
  hasCert: boolean;
  certCount: number;
  combination: KeyCombination;
  migrationStatus?: MigrationStatus;
  migrationIssuedAt?: string;
  migrationWindowDays?: number;
  migrationPostWindowAction?: "manual" | "auto";
  migrationHostEndpoint?: string;
  migrationCertId?: string;
  migrationRollbackStoredLine?: string;
  neverDecommission?: boolean;
}

export interface SshCert {
  id: string;
  certKeyId: string;
  certName: string;
  type: "user" | "host";
  associatedKeyId: string;
  associatedKeyName: string;
  hostname?: string;
  principals: string[];
  caName: string;
  serialNumber: string;
  status: CertStatus;
  validFrom: string;
  validTo: string;
  expiresIn: string;
  expiresInDays: number;
  endpoints: string[];
  extensions: string[];
  hostComplianceGroup?: string;
  complianceStatus: ComplianceStatus;
  origin?: "provision" | "migration";
}

// ─── Migration helpers ────────────────────────────────────────────────────────

export function migrationDaysElapsed(issuedAt: string): number {
  const issued = new Date(issuedAt);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24)));
}

export function migrationDaysRemaining(issuedAt: string, windowDays: number): number {
  return Math.max(0, windowDays - migrationDaysElapsed(issuedAt));
}

export function migrationWindowExpired(issuedAt: string, windowDays: number): boolean {
  return migrationDaysElapsed(issuedAt) >= windowDays;
}

export function isMigrationCertExpired(key: SshKey, certs: SshCert[]): boolean {
  if (key.migrationStatus !== "decommissioned" || !key.migrationCertId) return false;
  const cert = certs.find((c) => c.id === key.migrationCertId);
  return cert?.status === "Expired" || (cert?.expiresInDays !== undefined && cert.expiresInDays <= 0);
}

export function isMigrationCertExpiringSoon(key: SshKey, certs: SshCert[], warningDays = 14): boolean {
  if (key.migrationStatus !== "decommissioned" || !key.migrationCertId) return false;
  const cert = certs.find((c) => c.id === key.migrationCertId);
  return cert?.status === "Active" && cert.expiresInDays > 0 && cert.expiresInDays <= warningDays;
}

const fp = (s: string) => s.padEnd(24, "x").slice(0, 24) + "...";

// ---------- USER KEYS ----------
// Named keys: most are healthy for demo. Only 4 risky, 5 with migration states.
const namedUserKeys: SshKey[] = [
  // ── Healthy clean keys (good for demo migration flow) ──────────────────────
  {
    id: "uk1",
    name: "appviewxkey",
    type: "user",
    encryption: "ED25519",
    length: 256,
    age: "6 days",
    associatedUsers: ["appviewx"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("gNQHf69je9hPssY1NV"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/appviewx/.ssh/id_ed25519"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    id: "uk2",
    name: "SSHnewkey",
    type: "user",
    encryption: "ED25519",
    length: 256,
    age: "6 days",
    associatedUsers: ["admin"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["192.168.223.50"],
    fingerprint: fp("3FgGK1qnfw6OLTiG36"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/admin/.ssh/id_ed25519"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
    migrationStatus: "awaiting_confirmation",
    migrationIssuedAt: "2026-06-15",
    migrationWindowDays: 14,
    migrationPostWindowAction: "manual",
    migrationHostEndpoint: "192.168.223.50",
    migrationCertId: "uc-mig-2",
    migrationRollbackStoredLine: `from="192.168.223.0/24" ssh-ed25519 ${fp("3FgGK1qnfw6OLTiG36")} admin@corp.com`,
  },
  // ── Risky keys (for tile demo) ─────────────────────────────────────────────
  {
    id: "uk3",
    name: "Test",
    type: "user",
    encryption: "RSA",
    length: 4096,
    age: "7 days",
    associatedUsers: [],
    clientEndpoints: [],
    hostEndpoints: [],
    fingerprint: fp("ncsQwhxI0kIFFi9d4xA"),
    status: "Active",
    riskStatus: "Rogue",
    complianceStatus: "Non-Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "public_only",
  },
  {
    id: "uk4",
    name: "FetchKey_admin_1778565a",
    type: "user",
    encryption: "ECDSA",
    length: 256,
    age: "12 days",
    associatedUsers: ["admin"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("6Y6dZCt7MAEIf9Ik5dE"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/admin/.ssh/"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    id: "uk5",
    name: "FetchKey_admin_1778565b",
    type: "user",
    encryption: "ECDSA",
    length: 256,
    age: "12 days",
    associatedUsers: ["admin2"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("kz2BiD+BIO1XqLlnLCof"),
    status: "Active",
    riskStatus: "Misplaced",
    complianceStatus: "Non-Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_only",
  },
  {
    // in_coexistence — day 3 of 14
    id: "uk6",
    name: "FetchKey_admin_1778565c",
    type: "user",
    encryption: "RSA",
    length: 2048,
    age: "12 days",
    associatedUsers: ["admin"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("ieruDqV4sUmWWlcuTy"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/admin/.ssh/"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
    migrationStatus: "in_coexistence",
    migrationIssuedAt: "2026-07-12",
    migrationWindowDays: 14,
    migrationPostWindowAction: "manual",
    migrationHostEndpoint: "192.168.223.51",
    migrationCertId: "uc-mig-1",
    migrationRollbackStoredLine: `from="10.0.0.0/8",command="/usr/bin/backup",no-pty,no-port-forwarding ssh-rsa ${fp("ieruDqV4sUmWWlcuTy")} admin@corp.com`,
  },
  {
    id: "uk7",
    name: "FetchKey_admin_1778565d",
    type: "user",
    encryption: "RSA",
    length: 2048,
    age: "14 days",
    associatedUsers: ["devops"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["10.0.1.50"],
    fingerprint: fp("7zYCqzr8NBIV49xSo07"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/devops/.ssh/"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    id: "uk8",
    name: "FetchKey_admin_1778565e",
    type: "user",
    encryption: "ECDSA",
    length: 256,
    age: "12 days",
    associatedUsers: ["svcuser"],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: ["10.0.1.51"],
    fingerprint: fp("kbaVhZ2KQcsrBAzDDX"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/svcuser/.ssh/"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    // decommissioned — migration complete, cert active
    id: "uk9",
    name: "FetchKey_devops_prod01",
    type: "user",
    encryption: "ED25519",
    length: 256,
    age: "45 days",
    associatedUsers: ["devops"],
    clientEndpoints: ["10.0.1.50"],
    hostEndpoints: ["10.0.1.51"],
    fingerprint: fp("aB3xKp9mLqRsT7vU2w"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/devops/.ssh/"],
    comment: "Production key",
    keyComplianceGroup: "Prod_Group",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
    migrationStatus: "decommissioned",
    migrationIssuedAt: "2026-05-20",
    migrationWindowDays: 14,
    migrationPostWindowAction: "auto",
    migrationHostEndpoint: "10.0.1.51",
    migrationCertId: "uc5",
    migrationRollbackStoredLine: `ssh-ed25519 ${fp("aB3xKp9mLqRsT7vU2w")} devops@corp.com`,
  },
  {
    // CRITICAL EDGE CASE: decommissioned + migration cert expired
    id: "uk10",
    name: "FetchKey_svc_jenkins",
    type: "user",
    encryption: "RSA",
    length: 4096,
    age: "623 days",
    associatedUsers: ["jenkins"],
    clientEndpoints: ["10.0.2.10"],
    hostEndpoints: ["10.0.2.20"],
    fingerprint: fp("cD4yLr0nMtSuV8wX3z"),
    status: "Active",
    riskStatus: "Suspicious",
    complianceStatus: "Non-Compliant",
    filePaths: ["/var/lib/jenkins/.ssh/"],
    comment: "CI service account",
    keyComplianceGroup: "Service_Group",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
    migrationStatus: "decommissioned",
    migrationIssuedAt: "2026-04-01",
    migrationWindowDays: 14,
    migrationPostWindowAction: "auto",
    migrationHostEndpoint: "10.0.2.20",
    migrationCertId: "uc-mig-3",
    migrationRollbackStoredLine: `ssh-rsa ${fp("cD4yLr0nMtSuV8wX3z")} jenkins@corp.com`,
  },
  {
    // rolled_back
    id: "uk11",
    name: "FetchKey_admin_backup01",
    type: "user",
    encryption: "ECDSA",
    length: 256,
    age: "356 days",
    associatedUsers: ["backup"],
    clientEndpoints: ["192.168.1.100"],
    hostEndpoints: ["192.168.1.101"],
    fingerprint: fp("eF5zMs1oNuTvW9xY4a"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: ["/home/backup/.ssh/"],
    comment: "",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
    migrationStatus: "rolled_back",
    migrationIssuedAt: "2026-03-15",
    migrationWindowDays: 14,
    migrationPostWindowAction: "manual",
    migrationHostEndpoint: "192.168.1.101",
  },
  {
    // Shared key
    id: "uk12",
    name: "FetchKey_shared_deploy",
    type: "user",
    encryption: "RSA",
    length: 2048,
    age: "180 days",
    associatedUsers: ["user1", "user2", "user3"],
    clientEndpoints: ["10.0.3.5"],
    hostEndpoints: ["10.0.3.6"],
    fingerprint: fp("gH6aNt2pOvUwX0yZ5b"),
    status: "Active",
    riskStatus: "Shared",
    complianceStatus: "Non-Compliant",
    filePaths: ["/home/shared/.ssh/"],
    comment: "Shared deployment key - TO REPLACE",
    keyComplianceGroup: "Default",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    id: "uk-pqc1", name: "pqc_devops_admin", type: "user", encryption: "MLDSA44-ED25519", length: 0, age: "12 days",
    associatedUsers: ["devops"], clientEndpoints: ["10.0.9.10"], hostEndpoints: ["10.0.9.20"],
    fingerprint: fp("pqcA1mLdSa44Ed25519"), status: "Active", riskStatus: "None", complianceStatus: "Compliant",
    filePaths: ["/home/devops/.ssh/id_mldsa44_ed25519"], comment: "", keyComplianceGroup: "Prod_Group",
    hasCert: false, certCount: 0, combination: "private_public",
  },
  {
    id: "uk-pqc2", name: "pqc_ci_shared", type: "user", encryption: "MLDSA44-ED25519", length: 0, age: "9 days",
    associatedUsers: ["ci-runner", "build-svc"], clientEndpoints: ["10.0.9.10"], hostEndpoints: ["10.0.9.21"],
    fingerprint: fp("pqcB2mLdSa44Ed25519"), status: "Active", riskStatus: "Shared", complianceStatus: "Non-Compliant",
    filePaths: ["/home/ci/.ssh/id_mldsa44_ed25519"], comment: "", keyComplianceGroup: "Prod_Group",
    hasCert: false, certCount: 0, combination: "private_public",
  },
  {
    id: "uk-pqc3", name: "pqc_build_svc", type: "user", encryption: "MLDSA44-ED25519", length: 0, age: "6 days",
    associatedUsers: ["svc-build"], clientEndpoints: ["10.0.9.10"], hostEndpoints: ["10.0.9.22"],
    fingerprint: fp("pqcC3mLdSa44Ed25519"), status: "Active", riskStatus: "None", complianceStatus: "Compliant",
    filePaths: ["/home/svc-build/.ssh/id_mldsa44_ed25519"], comment: "", keyComplianceGroup: "Prod_Group",
    hasCert: false, certCount: 0, combination: "private_public",
  },
  {
    id: "uk-pqc4", name: "pqc_platform_ops", type: "user", encryption: "MLDSA44-ED25519", length: 0, age: "20 days",
    associatedUsers: ["platform-ops"], clientEndpoints: ["10.0.9.10"], hostEndpoints: ["10.0.9.20", "10.0.9.21"],
    fingerprint: fp("pqcD4mLdSa44Ed25519"), status: "Active", riskStatus: "None", complianceStatus: "Compliant",
    filePaths: ["/home/platform-ops/.ssh/id_mldsa44_ed25519"], comment: "", keyComplianceGroup: "Prod_Group",
    hasCert: true, certCount: 1, combination: "private_cert",
  },
  {
    id: "uk-pqc5", name: "pqc_cnsa_admin", type: "user", encryption: "MLDSA87-P384", length: 0, age: "4 days",
    associatedUsers: ["secadmin"], clientEndpoints: [], hostEndpoints: ["10.0.9.20"],
    fingerprint: fp("pqcE5mLdSa87P384xx"), status: "Active", riskStatus: "None", complianceStatus: "Compliant",
    filePaths: ["/home/secadmin/.ssh/authorized_keys"], comment: "", keyComplianceGroup: "Prod_Group",
    hasCert: false, certCount: 0, combination: "public_only",
  },
  {
    id: "uk-unk1", name: "legacy_batch_key", type: "user", encryption: "Unknown", length: 0, age: "812 days",
    associatedUsers: ["svc-legacy"], clientEndpoints: [], hostEndpoints: ["10.0.2.40"],
    fingerprint: fp("unk9RawIdentifier12"), status: "Active", riskStatus: "None", complianceStatus: "Non-Compliant",
    filePaths: ["/home/svc-legacy/.ssh/authorized_keys"], comment: "", keyComplianceGroup: "Default",
    hasCert: false, certCount: 0, combination: "public_only", rawAlgorithm: "ssh-xmss@openssh.com",
  },
];

// Generated keys — all healthy for demo
const generated: SshKey[] = [];
const encs: SshKey["encryption"][] = ["ED25519", "RSA", "ECDSA"];
const lens = { ED25519: 256, RSA: 2048, ECDSA: 256, "MLDSA44-ED25519": 0, "MLDSA87-P384": 0, Unknown: 0 } as const;
for (let i = 0; i < 63; i++) {
  const enc = encs[i % 3];
  generated.push({
    id: `uk${i + 13}`,
    name: `FetchKey_user_${(1000 + i).toString(16)}`,
    type: "user",
    encryption: enc,
    length: lens[enc],
    age: `${20 + ((i * 17) % 600)} days`,
    associatedUsers: i % 3 === 0 ? [`user${i % 10}`] : [],
    clientEndpoints: i % 2 === 0 ? [`10.0.${(i % 6) + 1}.${(i * 7) % 250}`] : [],
    hostEndpoints: i % 2 === 0 ? [`10.0.${(i % 6) + 1}.${(i * 11) % 250}`] : [],
    fingerprint: fp(`gen${i}HashValue${i * 3}`),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: i % 7 === 0 ? "Prod_Group" : "Default",
    hasCert: i % 11 === 0,
    certCount: i % 11 === 0 ? 1 : 0,
    combination: i % 11 === 0 ? "private_cert" : "private_public",
  });
}

export const USER_KEYS: SshKey[] = [...namedUserKeys, ...generated];

// ---------- HOST KEYS ----------
const namedHostKeys: SshKey[] = [
  {
    id: "hk1",
    name: "FetchKey_host_1778565a",
    type: "host",
    encryption: "ECDSA",
    length: 256,
    age: "—",
    associatedUsers: [],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: [],
    fingerprint: fp("hI7bOu3qPwVxY1zA6c"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default_Host_Group",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
  },
  {
    id: "hk2",
    name: "FetchKey_host_1778565b",
    type: "host",
    encryption: "ECDSA",
    length: 256,
    age: "—",
    associatedUsers: [],
    clientEndpoints: ["192.168.223.51"],
    hostEndpoints: [],
    fingerprint: fp("iJ8cPv4rQxWyZ2aB7d"),
    status: "Active",
    riskStatus: "Weak",
    complianceStatus: "Non-Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default_Host_Group",
    hasCert: true,
    certCount: 1,
    combination: "private_cert",
  },
  {
    id: "hk3",
    name: "FetchKey_host_1778565c",
    type: "host",
    encryption: "RSA",
    length: 4096,
    age: "623 days",
    associatedUsers: [],
    clientEndpoints: [],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("jK9dQw5sRyXzA3bC8e"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default_Host_Group",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
  {
    id: "hk4",
    name: "FetchKey_host_1778565d",
    type: "host",
    encryption: "ECDSA",
    length: 256,
    age: "356 days",
    associatedUsers: [],
    clientEndpoints: [],
    hostEndpoints: ["192.168.223.51"],
    fingerprint: fp("kL0eRx6tSzYaB4cD9f"),
    status: "Active",
    riskStatus: "None",
    complianceStatus: "Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: "Default_Host_Group",
    hasCert: false,
    certCount: 0,
    combination: "private_public",
  },
];
const moreHostKeys: SshKey[] = Array.from({ length: 19 }, (_, i) => ({
  id: `hk${i + 5}`,
  name: `FetchKey_host_${(2000 + i).toString(16)}`,
  type: "host" as const,
  encryption: (i % 9 === 4 ? "MLDSA44-ED25519" : encs[i % 3]) as KeyEncryption,
  length: i % 9 === 4 ? 0 : lens[encs[i % 3]],
  age: `${30 + ((i * 23) % 500)} days`,
  associatedUsers: [],
  clientEndpoints: i % 2 === 0 ? [`192.168.${i}.50`] : [],
  hostEndpoints: i % 2 === 1 ? [`192.168.${i}.51`] : [],
  fingerprint: fp(`hostgen${i}value`),
  status: "Active" as const,
  riskStatus: "None" as RiskStatus,
  complianceStatus: "Compliant" as ComplianceStatus,
  filePaths: [],
  comment: "",
  keyComplianceGroup: "Default_Host_Group",
  hasCert: false,
  certCount: 0,
  combination: "private_public" as KeyCombination,
}));
export const HOST_KEYS: SshKey[] = [...namedHostKeys, ...moreHostKeys];

// ---------- HOSTS ----------
export interface Host {
  id: string;
  deviceName: string;
  fqdn: string;
  hostName: string;
  hostNameStatus: "active" | "inactive";
  group: string;
  hostStatus: "Managed" | "Unmanaged";
  client: string;
  accessType: string;
  username: string;
  port: number;
  vendor: string;
  lastSyncTime: string;
  instanceId: string;
  hostPermission: string;
  allowedPrincipals: string;
  openSshVersion?: string;
  hybridUses?: HybridUses; // for MLDSA44-ED25519; undefined when it could not be read
}

export interface HybridUses {
  acceptUserKeys: boolean;
  acceptUserCerts: boolean;
  presentHostKey: boolean;
  presentHostCert: boolean;
  clientUse: boolean;
}

export type HybridReadiness = "Ready" | "Partially Ready" | "Not Ready" | "Unknown";

export const HYBRID_USE_LABELS: { key: keyof HybridUses; label: string }[] = [
  { key: "acceptUserKeys", label: "Accepts hybrid user keys for login" },
  { key: "acceptUserCerts", label: "Accepts hybrid user certificates for login" },
  { key: "presentHostKey", label: "Presents a hybrid host key" },
  { key: "presentHostCert", label: "Presents a hybrid host certificate" },
  { key: "clientUse", label: "Connects to other hosts using a hybrid key" },
];

export function hostReadiness(h: Host): HybridReadiness {
  if (!h.hybridUses) return "Unknown";
  const values = Object.values(h.hybridUses);
  if (values.every(Boolean)) return "Ready";
  if (values.some(Boolean)) return "Partially Ready";
  return "Not Ready";
}

export const findHost = (endpoint: string): Host | undefined =>
  HOSTS.find((h) => h.deviceName === endpoint || h.fqdn === endpoint);

const ALL_USES: HybridUses = { acceptUserKeys: true, acceptUserCerts: true, presentHostKey: true, presentHostCert: true, clientUse: true };
const NO_USES: HybridUses = { acceptUserKeys: false, acceptUserCerts: false, presentHostKey: false, presentHostCert: false, clientUse: false };

export const HOSTS: Host[] = [
  {
    id: "h1",
    deviceName: "192.168.223.50",
    fqdn: "192.168.223.50",
    hostName: "sshHostCA.appviewx.net",
    hostNameStatus: "active",
    group: "Default_Host_Group",
    hostStatus: "Managed",
    client: "SSH Client",
    accessType: "SSH",
    username: "admin",
    port: 22,
    vendor: "Linux",
    lastSyncTime: "2026-05-20 14:32:00",
    instanceId: "i-0a1b2c3d4e5f",
    hostPermission: "Full",
    allowedPrincipals: "devteam,admins",
    openSshVersion: "10.4",
    hybridUses: ALL_USES,
  },
  {
    id: "h2",
    deviceName: "192.168.223.51",
    fqdn: "192.168.223.51",
    hostName: "sshclientA.appviewx.net",
    hostNameStatus: "active",
    group: "Default_Host_Group",
    hostStatus: "Managed",
    client: "SSH Client",
    accessType: "SSH",
    username: "admin",
    port: 22,
    vendor: "Linux",
    lastSyncTime: "2026-05-20 14:30:00",
    instanceId: "i-1b2c3d4e5f6a",
    hostPermission: "Full",
    allowedPrincipals: "devteam,admins,appviewx",
    openSshVersion: "10.3",
    hybridUses: NO_USES,
  },
  { id: "h3", deviceName: "10.0.9.10", fqdn: "10.0.9.10", hostName: "dev-client-01.appviewx.net", hostNameStatus: "active", group: "Prod_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-09-27 09:10:00", instanceId: "i-pqc0010", hostPermission: "Full", allowedPrincipals: "devops",
    openSshVersion: "10.4", hybridUses: ALL_USES },
  { id: "h4", deviceName: "10.0.9.20", fqdn: "10.0.9.20", hostName: "pqc-app-01.appviewx.net", hostNameStatus: "active", group: "Prod_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-09-27 09:12:00", instanceId: "i-pqc0020", hostPermission: "Full", allowedPrincipals: "devops",
    openSshVersion: "10.4", hybridUses: ALL_USES },
  { id: "h5", deviceName: "10.0.9.21", fqdn: "10.0.9.21", hostName: "pqc-app-02.appviewx.net", hostNameStatus: "active", group: "Prod_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-09-27 09:14:00", instanceId: "i-pqc0021", hostPermission: "Full", allowedPrincipals: "ci-runner",
    openSshVersion: "10.4", hybridUses: ALL_USES },
  { id: "h6", deviceName: "10.0.9.22", fqdn: "10.0.9.22", hostName: "pqc-app-03.appviewx.net", hostNameStatus: "active", group: "Prod_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-09-27 09:16:00", instanceId: "i-pqc0022", hostPermission: "Full", allowedPrincipals: "svc-build",
    openSshVersion: "10.4", hybridUses: { acceptUserKeys: true, acceptUserCerts: false, presentHostKey: false, presentHostCert: false, clientUse: true } },
  { id: "h7", deviceName: "10.0.2.40", fqdn: "10.0.2.40", hostName: "legacy-batch-01.appviewx.net", hostNameStatus: "active", group: "Default_Host_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-09-26 22:40:00", instanceId: "i-leg0040", hostPermission: "Full", allowedPrincipals: "svc-legacy" },
];

// ---------- USER CERTS ----------
export const USER_CERTS: SshCert[] = [
  {
    id: "uc-pqc1", certKeyId: "UC-2026-901", certName: "cert-pqc_platform_ops", type: "user",
    associatedKeyId: "uk-pqc4", associatedKeyName: "pqc_platform_ops", principals: ["platform-ops"], caName: "Default-Infra-CA",
    serialNumber: "990112233445", status: "Active", validFrom: "2026-09-15", validTo: "2026-11-14", expiresIn: "48 days",
    expiresInDays: 48, endpoints: ["10.0.9.20", "10.0.9.21"], extensions: ["permit-pty"], complianceStatus: "Compliant", origin: "provision",
  },
  {
    id: "uc1",
    certKeyId: "UC-2026-001",
    certName: "cert-appviewxkey-ravi",
    type: "user",
    associatedKeyId: "uk1",
    associatedKeyName: "appviewxkey",
    principals: ["Ravi", "devteam"],
    caName: "Default-Infra-CA",
    serialNumber: "364291275843",
    status: "Expired",
    validFrom: "2026-05-14",
    validTo: "2026-05-21",
    expiresIn: "0 day(s)",
    expiresInDays: 0,
    endpoints: ["192.168.223.51"],
    extensions: ["X11 forwarding", "port-forwarding", "agent-forwarding", "pty", "user-rc"],
    complianceStatus: "Non-Compliant",
    origin: "provision",
  },
  {
    id: "uc2",
    certKeyId: "UC-2026-002",
    certName: "cert-fetchkey-admin-prod",
    type: "user",
    associatedKeyId: "uk4",
    associatedKeyName: "FetchKey_admin_1778565a",
    principals: ["admin", "devops"],
    caName: "Default-Infra-CA",
    serialNumber: "498271635748",
    status: "Active",
    validFrom: "2026-05-01",
    validTo: "2026-08-01",
    expiresIn: "47 days",
    expiresInDays: 47,
    endpoints: ["192.168.223.51", "10.0.1.50"],
    extensions: ["port-forwarding", "agent-forwarding", "pty"],
    complianceStatus: "Compliant",
    origin: "provision",
  },
  {
    id: "uc3",
    certKeyId: "UC-2026-003",
    certName: "cert-fetchkey-admin-staging",
    type: "user",
    associatedKeyId: "uk4",
    associatedKeyName: "FetchKey_admin_1778565a",
    principals: ["admin"],
    caName: "Default-Infra-CA",
    serialNumber: "512748361920",
    status: "Active",
    validFrom: "2026-04-15",
    validTo: "2026-07-31",
    expiresIn: "46 days",
    expiresInDays: 46,
    endpoints: ["192.168.223.51"],
    extensions: ["pty", "port-forwarding"],
    complianceStatus: "Compliant",
    origin: "provision",
  },
  {
    id: "uc4",
    certKeyId: "UC-2026-004",
    certName: "cert-fetchkey-e-key1",
    type: "user",
    associatedKeyId: "uk8",
    associatedKeyName: "FetchKey_admin_1778565e",
    principals: ["svcuser"],
    caName: "Default-Infra-CA",
    serialNumber: "623817492038",
    status: "Active",
    validFrom: "2026-05-10",
    validTo: "2026-08-10",
    expiresIn: "26 days",
    expiresInDays: 26,
    endpoints: ["192.168.223.51"],
    extensions: ["pty"],
    complianceStatus: "Compliant",
    origin: "provision",
  },
  {
    id: "uc5",
    certKeyId: "avx|src:aB3xKp9m|host:10.0.1.51|op:admin@corp|ts:20260520|pol:Prod",
    certName: "cert-devops-prod01-mig",
    type: "user",
    associatedKeyId: "uk9",
    associatedKeyName: "FetchKey_devops_prod01",
    principals: ["devops"],
    caName: "Prod-CA",
    serialNumber: "mig-20260520-005",
    status: "Active",
    validFrom: "2026-05-20",
    validTo: "2026-08-20",
    expiresIn: "36 days",
    expiresInDays: 36,
    endpoints: ["10.0.1.50", "10.0.1.51"],
    extensions: [],
    complianceStatus: "Compliant",
    origin: "migration",
  },
  {
    id: "uc7",
    certKeyId: "UC-2026-007",
    certName: "cert-orphaned-svcbatch",
    type: "user",
    associatedKeyId: "unmanaged",
    associatedKeyName: "external-unmanaged-key",
    principals: ["svc-batch"],
    caName: "Default-Infra-CA",
    serialNumber: "901234567890",
    status: "Active",
    validFrom: "2026-04-01",
    validTo: "2026-07-01",
    expiresIn: "0 days",
    expiresInDays: 0,
    endpoints: ["10.0.5.30"],
    extensions: ["pty"],
    complianceStatus: "Non-Compliant",
    origin: "provision",
  },
  {
    id: "uc-mig-1",
    certKeyId: "avx|src:ieruDqV4|host:192.168.223.51|op:admin@corp|ts:20260712|pol:Default",
    certName: "cert-fetchkey-admin-1778565c-mig",
    type: "user",
    associatedKeyId: "uk6",
    associatedKeyName: "FetchKey_admin_1778565c",
    principals: ["admin"],
    caName: "Default-Infra-CA",
    serialNumber: "mig-20260712-001",
    status: "Active",
    validFrom: "2026-07-12",
    validTo: "2026-10-12",
    expiresIn: "89 days",
    expiresInDays: 89,
    endpoints: ["192.168.223.51"],
    extensions: [],
    complianceStatus: "Compliant",
    origin: "migration",
  },
  {
    id: "uc-mig-2",
    certKeyId: "avx|src:3FgGK1qn|host:192.168.223.50|op:admin@corp|ts:20260615|pol:Default",
    certName: "cert-sshnewkey-mig",
    type: "user",
    associatedKeyId: "uk2",
    associatedKeyName: "SSHnewkey",
    principals: ["admin"],
    caName: "Default-Infra-CA",
    serialNumber: "mig-20260615-002",
    status: "Active",
    validFrom: "2026-06-15",
    validTo: "2026-09-15",
    expiresIn: "62 days",
    expiresInDays: 62,
    endpoints: ["192.168.223.50"],
    extensions: [],
    complianceStatus: "Compliant",
    origin: "migration",
  },
  {
    id: "uc-mig-3",
    certKeyId: "avx|src:cD4yLr0n|host:10.0.2.20|op:admin@corp|ts:20260401|pol:Service",
    certName: "cert-svc-jenkins-mig",
    type: "user",
    associatedKeyId: "uk10",
    associatedKeyName: "FetchKey_svc_jenkins",
    principals: ["jenkins"],
    caName: "Default-Infra-CA",
    serialNumber: "mig-20260401-003",
    status: "Expired",
    validFrom: "2026-04-01",
    validTo: "2026-05-01",
    expiresIn: "-75 days",
    expiresInDays: -75,
    endpoints: ["10.0.2.20"],
    extensions: [],
    complianceStatus: "Non-Compliant",
    origin: "migration",
  },
];

// ---------- HOST CERTS ----------
export const HOST_CERTS: SshCert[] = [
  {
    id: "hc1",
    certKeyId: "HC-2026-001",
    certName: "cert-sshHostCA-host50",
    type: "host",
    associatedKeyId: "hk1",
    associatedKeyName: "FetchKey_host_1778565a",
    hostname: "sshHostCA.appviewx.net",
    principals: [],
    caName: "Default-Infra-CA",
    serialNumber: "956140725369",
    status: "Active",
    validFrom: "2026-05-01",
    validTo: "2026-07-01",
    expiresIn: "41 days",
    expiresInDays: 41,
    endpoints: ["192.168.223.50"],
    extensions: [],
    hostComplianceGroup: "Default_Host_Group",
    complianceStatus: "Compliant",
    origin: "provision",
  },
  {
    id: "hc2",
    certKeyId: "HC-2026-002",
    certName: "cert-sshclientA-host51",
    type: "host",
    associatedKeyId: "hk2",
    associatedKeyName: "FetchKey_host_1778565b",
    hostname: "sshclientA.appviewx.net",
    principals: [],
    caName: "Default-Infra-CA",
    serialNumber: "067251836470",
    status: "Expired",
    validFrom: "2026-03-15",
    validTo: "2026-05-15",
    expiresIn: "0 days",
    expiresInDays: 0,
    endpoints: ["192.168.223.51"],
    extensions: [],
    hostComplianceGroup: "Default_Host_Group",
    complianceStatus: "Non-Compliant",
    origin: "provision",
  },
];

// ---------- ROTATED / DELETED ----------
export interface RotatedCert {
  id: string;
  certKeyId: string;
  certType: "User" | "Host";
  rotatedOn: string;
  previousValidTo: string;
  newValidTo: string;
  rotatedBy: string;
  endpoints: string[];
  rollbackAvailable: boolean;
  rollbackWindowExpiry: string;
  associatedKeyId: string;
}
export const ROTATED_CERTS: RotatedCert[] = [
  {
    id: "rc1",
    certKeyId: "UC-2026-000",
    certType: "User",
    rotatedOn: "2026-05-15 09:22:00",
    previousValidTo: "2026-05-20",
    newValidTo: "2026-08-20",
    rotatedBy: "admin@appviewx.com",
    endpoints: ["192.168.223.51"],
    rollbackAvailable: true,
    rollbackWindowExpiry: "2026-05-22",
    associatedKeyId: "uk1",
  },
  {
    id: "rc2",
    certKeyId: "HC-2026-000",
    certType: "Host",
    rotatedOn: "2026-05-10 14:05:00",
    previousValidTo: "2026-05-15",
    newValidTo: "2026-08-15",
    rotatedBy: "admin@appviewx.com",
    endpoints: ["192.168.223.50"],
    rollbackAvailable: false,
    rollbackWindowExpiry: "2026-05-17",
    associatedKeyId: "hk1",
  },
];

export interface DeletedCert {
  id: string;
  certKeyId: string;
  certType: "User" | "Host";
  deletedOn: string;
  deletedBy: string;
  reason: string;
  lastKnownEndpoints: string[];
  isRevoked: boolean;
  isExpired: boolean;
  validTo: string;
  associatedKeyId: string;
  associatedKeyName: string;
}
export const DELETED_CERTS: DeletedCert[] = [
  {
    id: "dc1",
    certKeyId: "UC-2025-099",
    certType: "User",
    deletedOn: "2026-05-18 11:30:00",
    deletedBy: "admin@appviewx.com",
    reason: "User offboarded",
    lastKnownEndpoints: ["192.168.223.51"],
    isRevoked: false,
    isExpired: false,
    validTo: "2026-09-01",
    associatedKeyId: "uk1",
    associatedKeyName: "appviewxkey",
  },
  {
    id: "dc2",
    certKeyId: "UC-2025-088",
    certType: "User",
    deletedOn: "2026-05-10 09:00:00",
    deletedBy: "sysadmin@appviewx.com",
    reason: "Certificate compromised",
    lastKnownEndpoints: ["10.0.1.50"],
    isRevoked: true,
    isExpired: false,
    validTo: "2026-07-01",
    associatedKeyId: "uk9",
    associatedKeyName: "FetchKey_devops_prod01",
  },
];

export interface DeletedKey {
  id: string;
  name: string;
  encryption: string;
  length: number;
  deletedOn: string;
  deletedBy: string;
  endpoints: string[];
}
export const DELETED_KEYS: DeletedKey[] = [
  {
    id: "dk1",
    name: "old-prod-key-2025",
    encryption: "RSA",
    length: 2048,
    deletedOn: "2026-05-19 10:15:00",
    deletedBy: "admin@appviewx.com",
    endpoints: ["192.168.223.51"],
  },
];

export interface RotatedKey {
  id: string;
  name: string;
  encryption: string;
  length: number;
  rotatedOn: string;
  rotatedBy: string;
  endpoints: string[];
}
export const ROTATED_KEYS: RotatedKey[] = [
  {
    id: "rk1",
    name: "FetchKey_admin_backup01",
    encryption: "ECDSA",
    length: 256,
    rotatedOn: "2026-05-18 14:45:00",
    rotatedBy: "admin@appviewx.com",
    endpoints: ["192.168.1.100"],
  },
];

// ---------- CAs ----------
export const CAS = [
  { id: "ca1", name: "Default-Infra-CA", type: "SSH", status: "Active", expiry: "2028-12-01" },
  { id: "ca2", name: "Prod-CA", type: "SSH", status: "Active", expiry: "2027-06-15" },
];

export const GROUPS = ["All Groups", "Default", "Default_Host_Group", "Prod_Group", "Service_Group"];

export const riskColor = (r: RiskStatus): string => {
  switch (r) {
    case "Rogue":
    case "Suspicious":
    case "Misplaced":
      return "text-risk-red bg-risk-red/10 border-risk-red/30";
    case "Shared":
    case "Weak":
      return "text-risk-amber bg-risk-amber/10 border-risk-amber/30";
    default:
      return "text-risk-green bg-risk-green/10 border-risk-green/30";
  }
};

export const migrationStatusColor = (s: MigrationStatus): string => {
  switch (s) {
    case "in_coexistence":
      return "text-risk-amber bg-risk-amber/10 border-risk-amber/30";
    case "awaiting_confirmation":
      return "text-risk-red bg-risk-red/10 border-risk-red/30";
    case "decommissioned":
      return "text-risk-green bg-risk-green/10 border-risk-green/30";
    case "rolled_back":
      return "text-muted-foreground bg-muted border-border";
  }
};

export const migrationStatusLabel: Record<MigrationStatus, string> = {
  in_coexistence: "In Migration",
  awaiting_confirmation: "Awaiting Confirm",
  decommissioned: "Migrated",
  rolled_back: "Rolled Back",
};

/** Algorithm of the key a certificate was issued to. */
export function certKeyAlgorithm(c: SshCert): KeyEncryption | undefined {
  const pool = c.type === "user" ? USER_KEYS : HOST_KEYS;
  return pool.find((k) => k.id === c.associatedKeyId)?.encryption;
}
