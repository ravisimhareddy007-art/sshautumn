// Mock data for AVX SSH prototype

export type RiskStatus = "None" | "Suspicious" | "Rogue" | "Misplaced" | "Weak" | "Shared";
export type ComplianceStatus = "Compliant" | "Non-Compliant";
export type KeyStatus = "Active" | "Inactive" | "Revoked";
export type CertStatus = "Active" | "Expired" | "Revoked";

export interface SshKey {
  id: string;
  name: string;
  type: "user" | "host";
  encryption: "ED25519" | "RSA" | "ECDSA";
  length: number;
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
  expiresInDays: number; // negative if expired
  endpoints: string[];
  extensions: string[];
  hostComplianceGroup?: string;
  complianceStatus: ComplianceStatus;
}

const fp = (s: string) => s.padEnd(24, "x").slice(0, 24) + "...";

// ---------- USER KEYS (12 named + 63 generated = 75) ----------
const namedUserKeys: SshKey[] = [
  { id: "uk1", name: "appviewxkey", type: "user", encryption: "ED25519", length: 256, age: "6 days", associatedUsers: ["appviewx"], clientEndpoints: ["192.168.223.51"], hostEndpoints: ["192.168.223.51"], fingerprint: fp("gNQHf69je9hPssY1NV"), status: "Active", riskStatus: "Suspicious", complianceStatus: "Non-Compliant", filePaths: ["/home/appviewx/.ssh/id_ed25519"], comment: "", keyComplianceGroup: "Default", hasCert: true, certCount: 1 },
  { id: "uk2", name: "SSHnewkey", type: "user", encryption: "ED25519", length: 256, age: "6 days", associatedUsers: [], clientEndpoints: [], hostEndpoints: [], fingerprint: fp("3FgGK1qnfw6OLTiG36"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk3", name: "Test", type: "user", encryption: "RSA", length: 4096, age: "7 days", associatedUsers: [], clientEndpoints: [], hostEndpoints: [], fingerprint: fp("ncsQwhxI0kIFFi9d4xA"), status: "Active", riskStatus: "Rogue", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk4", name: "FetchKey_admin_1778565a", type: "user", encryption: "ECDSA", length: 256, age: "12 days", associatedUsers: ["appviewx"], clientEndpoints: ["192.168.223.51"], hostEndpoints: ["192.168.223.51"], fingerprint: fp("6Y6dZCt7MAEIf9Ik5dE"), status: "Active", riskStatus: "Suspicious", complianceStatus: "Non-Compliant", filePaths: ["/home/admin/.ssh/"], comment: "", keyComplianceGroup: "Default", hasCert: true, certCount: 2 },
  { id: "uk5", name: "FetchKey_admin_1778565b", type: "user", encryption: "ECDSA", length: 256, age: "12 days", associatedUsers: ["appviewx"], clientEndpoints: ["192.168.223.51"], hostEndpoints: ["192.168.223.51"], fingerprint: fp("kz2BiD+BIO1XqLlnLCof"), status: "Active", riskStatus: "Misplaced", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk6", name: "FetchKey_admin_1778565c", type: "user", encryption: "RSA", length: 2048, age: "12 days", associatedUsers: [], clientEndpoints: ["192.168.223.51"], hostEndpoints: [], fingerprint: fp("ieruDqV4sUmWWlcuTy"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk7", name: "FetchKey_admin_1778565d", type: "user", encryption: "RSA", length: 2048, age: "—", associatedUsers: [], clientEndpoints: ["192.168.223.51"], hostEndpoints: [], fingerprint: fp("7zYCqzr8NBIV49xSo07"), status: "Active", riskStatus: "Rogue", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk8", name: "FetchKey_admin_1778565e", type: "user", encryption: "ECDSA", length: 256, age: "12 days", associatedUsers: ["key1"], clientEndpoints: ["192.168.223.51"], hostEndpoints: [], fingerprint: fp("kbaVhZ2KQcsrBAzDDX"), status: "Active", riskStatus: "Suspicious", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: true, certCount: 1 },
  { id: "uk9", name: "FetchKey_devops_prod01", type: "user", encryption: "ED25519", length: 256, age: "45 days", associatedUsers: ["devops"], clientEndpoints: ["10.0.1.50"], hostEndpoints: ["10.0.1.51"], fingerprint: fp("aB3xKp9mLqRsT7vU2w"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: ["/home/devops/.ssh/"], comment: "Production key", keyComplianceGroup: "Prod_Group", hasCert: true, certCount: 1 },
  { id: "uk10", name: "FetchKey_svc_jenkins", type: "user", encryption: "RSA", length: 4096, age: "623 days", associatedUsers: ["jenkins"], clientEndpoints: ["10.0.2.10"], hostEndpoints: ["10.0.2.20"], fingerprint: fp("cD4yLr0nMtSuV8wX3z"), status: "Active", riskStatus: "Suspicious", complianceStatus: "Non-Compliant", filePaths: ["/var/lib/jenkins/.ssh/"], comment: "CI service account", keyComplianceGroup: "Service_Group", hasCert: false, certCount: 0 },
  { id: "uk11", name: "FetchKey_admin_backup01", type: "user", encryption: "ECDSA", length: 256, age: "356 days", associatedUsers: ["backup"], clientEndpoints: ["192.168.1.100"], hostEndpoints: [], fingerprint: fp("eF5zMs1oNuTvW9xY4a"), status: "Active", riskStatus: "Misplaced", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
  { id: "uk12", name: "FetchKey_shared_deploy", type: "user", encryption: "RSA", length: 2048, age: "180 days", associatedUsers: ["user1", "user2", "user3"], clientEndpoints: ["10.0.3.5"], hostEndpoints: ["10.0.3.6"], fingerprint: fp("gH6aNt2pOvUwX0yZ5b"), status: "Active", riskStatus: "Shared", complianceStatus: "Non-Compliant", filePaths: ["/home/shared/.ssh/"], comment: "Shared deployment key - TO REPLACE", keyComplianceGroup: "Default", hasCert: false, certCount: 0 },
];

// Target risk distribution: shared=1, weak=0, rogue=3, misplaced=4, suspicious=9
// Already in named: shared=1, rogue=2, misplaced=2, suspicious=4
const generated: SshKey[] = [];
const encs: SshKey["encryption"][] = ["ED25519", "RSA", "ECDSA"];
const lens = { ED25519: 256, RSA: 2048, ECDSA: 256 } as const;
const remainingRisks: RiskStatus[] = [
  "Rogue",
  "Misplaced", "Misplaced",
  "Suspicious", "Suspicious", "Suspicious", "Suspicious", "Suspicious",
  ...Array(55).fill("None") as RiskStatus[],
];
for (let i = 0; i < 63; i++) {
  const enc = encs[i % 3];
  const risk = remainingRisks[i] ?? "None";
  generated.push({
    id: `uk${i + 13}`,
    name: `FetchKey_user_${(1000 + i).toString(16)}`,
    type: "user",
    encryption: enc,
    length: lens[enc],
    age: `${20 + ((i * 17) % 600)} days`,
    associatedUsers: i % 4 === 0 ? [`user${i}`] : [],
    clientEndpoints: i % 3 === 0 ? [`10.0.${(i % 6) + 1}.${(i * 7) % 250}`] : [],
    hostEndpoints: i % 5 === 0 ? [`10.0.${(i % 6) + 1}.${(i * 11) % 250}`] : [],
    fingerprint: fp(`gen${i}HashValue${i * 3}`),
    status: "Active",
    riskStatus: risk,
    complianceStatus: risk === "None" ? "Compliant" : "Non-Compliant",
    filePaths: [],
    comment: "",
    keyComplianceGroup: i % 7 === 0 ? "Prod_Group" : "Default",
    hasCert: i % 11 === 0,
    certCount: i % 11 === 0 ? 1 : 0,
  });
}

export const USER_KEYS: SshKey[] = [...namedUserKeys, ...generated];

// ---------- HOST KEYS (23) ----------
const namedHostKeys: SshKey[] = [
  { id: "hk1", name: "FetchKey_host_1778565a", type: "host", encryption: "ECDSA", length: 256, age: "—", associatedUsers: [], clientEndpoints: ["192.168.223.51"], hostEndpoints: [], fingerprint: fp("hI7bOu3qPwVxY1zA6c"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default_Host_Group", hasCert: true, certCount: 1 },
  { id: "hk2", name: "FetchKey_host_1778565b", type: "host", encryption: "ECDSA", length: 256, age: "—", associatedUsers: [], clientEndpoints: ["192.168.223.51"], hostEndpoints: [], fingerprint: fp("iJ8cPv4rQxWyZ2aB7d"), status: "Active", riskStatus: "Weak", complianceStatus: "Non-Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default_Host_Group", hasCert: true, certCount: 1 },
  { id: "hk3", name: "FetchKey_host_1778565c", type: "host", encryption: "RSA", length: 4096, age: "623 days", associatedUsers: [], clientEndpoints: [], hostEndpoints: ["192.168.223.51"], fingerprint: fp("jK9dQw5sRyXzA3bC8e"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default_Host_Group", hasCert: false, certCount: 0 },
  { id: "hk4", name: "FetchKey_host_1778565d", type: "host", encryption: "ECDSA", length: 256, age: "356 days", associatedUsers: [], clientEndpoints: [], hostEndpoints: ["192.168.223.51"], fingerprint: fp("kL0eRx6tSzYaB4cD9f"), status: "Active", riskStatus: "None", complianceStatus: "Compliant", filePaths: [], comment: "", keyComplianceGroup: "Default_Host_Group", hasCert: false, certCount: 0 },
];
const moreHostKeys: SshKey[] = Array.from({ length: 19 }, (_, i) => ({
  id: `hk${i + 5}`,
  name: `FetchKey_host_${(2000 + i).toString(16)}`,
  type: "host" as const,
  encryption: encs[i % 3],
  length: lens[encs[i % 3]],
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
}
export const HOSTS: Host[] = [
  { id: "h1", deviceName: "192.168.223.50", fqdn: "192.168.223.50", hostName: "sshHostCA.appviewx.net", hostNameStatus: "active", group: "Default_Host_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-05-20 14:32:00", instanceId: "i-0a1b2c3d4e5f", hostPermission: "Full", allowedPrincipals: "devteam,admins" },
  { id: "h2", deviceName: "192.168.223.51", fqdn: "192.168.223.51", hostName: "sshclientA.appviewx.net", hostNameStatus: "active", group: "Default_Host_Group", hostStatus: "Managed", client: "SSH Client", accessType: "SSH", username: "admin", port: 22, vendor: "Linux", lastSyncTime: "2026-05-20 14:30:00", instanceId: "i-1b2c3d4e5f6a", hostPermission: "Full", allowedPrincipals: "devteam,admins,appviewx" },
];

// ---------- USER CERTS ----------
export const USER_CERTS: SshCert[] = [
  { id: "uc1", certKeyId: "UC-2026-001", certName: "cert-appviewxkey-ravi", type: "user", associatedKeyId: "uk1", associatedKeyName: "appviewxkey", principals: ["Ravi", "devteam"], caName: "Default-Infra-CA", serialNumber: "364291275843", status: "Expired", validFrom: "2026-05-14", validTo: "2026-05-21", expiresIn: "0 day(s)", expiresInDays: 0, endpoints: ["192.168.223.51"], extensions: ["X11 forwarding", "port-forwarding", "agent-forwarding", "pty", "user-rc"], complianceStatus: "Non-Compliant" },
  { id: "uc2", certKeyId: "UC-2026-002", certName: "cert-fetchkey-admin-prod", type: "user", associatedKeyId: "uk4", associatedKeyName: "FetchKey_admin_1778565a", principals: ["admin", "devops"], caName: "Default-Infra-CA", serialNumber: "498271635748", status: "Active", validFrom: "2026-05-01", validTo: "2026-06-01", expiresIn: "11 days", expiresInDays: 11, endpoints: ["192.168.223.51", "10.0.1.50"], extensions: ["port-forwarding", "agent-forwarding", "pty"], complianceStatus: "Compliant" },
  { id: "uc3", certKeyId: "UC-2026-003", certName: "cert-fetchkey-admin-staging", type: "user", associatedKeyId: "uk4", associatedKeyName: "FetchKey_admin_1778565a", principals: ["admin"], caName: "Default-Infra-CA", serialNumber: "512748361920", status: "Active", validFrom: "2026-04-15", validTo: "2026-05-31", expiresIn: "10 days", expiresInDays: 10, endpoints: ["192.168.223.51"], extensions: ["pty", "port-forwarding"], complianceStatus: "Compliant" },
  { id: "uc4", certKeyId: "UC-2026-004", certName: "cert-fetchkey-e-key1", type: "user", associatedKeyId: "uk8", associatedKeyName: "FetchKey_admin_1778565e", principals: ["key1", "devteam"], caName: "Default-Infra-CA", serialNumber: "623817492038", status: "Active", validFrom: "2026-05-10", validTo: "2026-08-10", expiresIn: "81 days", expiresInDays: 81, endpoints: ["192.168.223.51"], extensions: ["X11 forwarding", "pty"], complianceStatus: "Compliant" },
  { id: "uc5", certKeyId: "UC-2026-005", certName: "cert-devops-prod01", type: "user", associatedKeyId: "uk9", associatedKeyName: "FetchKey_devops_prod01", principals: ["devops", "deploy"], caName: "Prod-CA", serialNumber: "734928503147", status: "Active", validFrom: "2026-04-01", validTo: "2026-05-25", expiresIn: "4 days", expiresInDays: 4, endpoints: ["10.0.1.50", "10.0.1.51"], extensions: ["port-forwarding", "pty"], complianceStatus: "Non-Compliant" },
  { id: "uc6", certKeyId: "UC-2026-006", certName: "cert-svc-deploy-old", type: "user", associatedKeyId: "uk6", associatedKeyName: "FetchKey_admin_1778565c", principals: ["svc-deploy"], caName: "Default-Infra-CA", serialNumber: "845039614258", status: "Expired", validFrom: "2026-03-01", validTo: "2026-04-01", expiresIn: "-50 days", expiresInDays: -50, endpoints: ["10.0.2.10"], extensions: ["pty"], complianceStatus: "Non-Compliant" },
];

// ---------- HOST CERTS ----------
export const HOST_CERTS: SshCert[] = [
  { id: "hc1", certKeyId: "HC-2026-001", certName: "cert-sshHostCA-host50", type: "host", associatedKeyId: "hk1", associatedKeyName: "FetchKey_host_1778565a", hostname: "sshHostCA.appviewx.net", principals: [], caName: "Default-Infra-CA", serialNumber: "956140725369", status: "Active", validFrom: "2026-05-01", validTo: "2026-07-01", expiresIn: "41 days", expiresInDays: 41, endpoints: ["192.168.223.50"], extensions: [], hostComplianceGroup: "Default_Host_Group", complianceStatus: "Compliant" },
  { id: "hc2", certKeyId: "HC-2026-002", certName: "cert-sshclientA-host51", type: "host", associatedKeyId: "hk2", associatedKeyName: "FetchKey_host_1778565b", hostname: "sshclientA.appviewx.net", principals: [], caName: "Default-Infra-CA", serialNumber: "067251836470", status: "Expired", validFrom: "2026-03-15", validTo: "2026-05-15", expiresIn: "0 days", expiresInDays: 0, endpoints: ["192.168.223.51"], extensions: [], hostComplianceGroup: "Default_Host_Group", complianceStatus: "Non-Compliant" },
];

// ---------- ROTATED CERTS ----------
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
}
export const ROTATED_CERTS: RotatedCert[] = [
  { id: "rc1", certKeyId: "UC-2026-000", certType: "User", rotatedOn: "2026-05-15 09:22:00", previousValidTo: "2026-05-20", newValidTo: "2026-08-20", rotatedBy: "admin@appviewx.com", endpoints: ["192.168.223.51"], rollbackAvailable: true, rollbackWindowExpiry: "2026-05-22" },
  { id: "rc2", certKeyId: "HC-2026-000", certType: "Host", rotatedOn: "2026-05-10 14:05:00", previousValidTo: "2026-05-15", newValidTo: "2026-08-15", rotatedBy: "admin@appviewx.com", endpoints: ["192.168.223.50"], rollbackAvailable: false, rollbackWindowExpiry: "2026-05-17" },
];

// ---------- DELETED CERTS ----------
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
}
export const DELETED_CERTS: DeletedCert[] = [
  { id: "dc1", certKeyId: "UC-2025-099", certType: "User", deletedOn: "2026-05-18 11:30:00", deletedBy: "admin@appviewx.com", reason: "User offboarded", lastKnownEndpoints: ["192.168.223.51"], isRevoked: false, isExpired: false, validTo: "2026-09-01" },
  { id: "dc2", certKeyId: "UC-2025-088", certType: "User", deletedOn: "2026-05-10 09:00:00", deletedBy: "sysadmin@appviewx.com", reason: "Certificate compromised", lastKnownEndpoints: ["10.0.1.50"], isRevoked: true, isExpired: false, validTo: "2026-07-01" },
];

// ---------- DELETED / ROTATED KEYS ----------
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
  { id: "dk1", name: "old-prod-key-2025", encryption: "RSA", length: 2048, deletedOn: "2026-05-19 10:15:00", deletedBy: "admin@appviewx.com", endpoints: ["192.168.223.51"] },
  { id: "dk2", name: "test-key-expired", encryption: "ECDSA", length: 256, deletedOn: "2026-05-15 08:00:00", deletedBy: "devops@appviewx.com", endpoints: [] },
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
  { id: "rk1", name: "FetchKey_admin_backup01", encryption: "ECDSA", length: 256, rotatedOn: "2026-05-18 14:45:00", rotatedBy: "admin@appviewx.com", endpoints: ["192.168.1.100"] },
];

// ---------- CAs ----------
export const CAS = [
  { id: "ca1", name: "Default-Infra-CA", type: "SSH", status: "Active", expiry: "2028-12-01" },
  { id: "ca2", name: "Prod-CA", type: "SSH", status: "Active", expiry: "2027-06-15" },
];

export const GROUPS = ["All Groups", "Default", "Default_Host_Group", "Prod_Group", "Service_Group"];

// ---------- Risk colors helper ----------
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
