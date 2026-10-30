// Discovery runs, schedules and access groups shown on the Discovery and Groups pages.

export type DiscoverTarget = "User Keys" | "Host Keys" | "PGP Keys";

export interface DiscoveryRun {
  id: string;
  name: string;
  range: string;
  startedAt: string;
  by: string;
  mode: "Instant" | "Scheduled";
  status: "Running" | "Completed" | "Failed";
  discover: DiscoverTarget[];
  hostsScanned: number;
  hostsReached: number;
  userKeys: number;
  hostKeys: number;
  pgpKeys: number;
  keyGroup: string;
  inventoryAction: "Do Not Move" | "Manage" | "Monitor";
}

export interface DiscoverySchedule {
  id: string;
  name: string;
  range: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  time: string;
  nextRun: string;
  discover: DiscoverTarget[];
  enabled: boolean;
  by: string;
}

export interface InfraAccessGroup {
  name: string;
  description: string;
  hosts: number;
  createdBy: string;
}

export interface HostGroup {
  name: string;
  description: string;
  policy: string;
}

export const SEED_RUNS: DiscoveryRun[] = [
  {
    id: "run-3",
    name: "Finance network sweep",
    range: "10.20.4.1 - 10.20.4.254",
    startedAt: "2026-10-29 06:10",
    by: "sam.ops",
    mode: "Scheduled",
    status: "Completed",
    discover: ["User Keys", "Host Keys", "PGP Keys"],
    hostsScanned: 254,
    hostsReached: 41,
    userKeys: 38,
    hostKeys: 41,
    pgpKeys: 18,
    keyGroup: "Finance_Key_Group",
    inventoryAction: "Manage",
  },
  {
    id: "run-2",
    name: "Build farm",
    range: "10.30.1.1 - 10.30.1.64",
    startedAt: "2026-10-27 14:32",
    by: "admin",
    mode: "Instant",
    status: "Completed",
    discover: ["User Keys", "Host Keys"],
    hostsScanned: 64,
    hostsReached: 12,
    userKeys: 22,
    hostKeys: 12,
    pgpKeys: 0,
    keyGroup: "Default_Key_Group",
    inventoryAction: "Manage",
  },
  {
    id: "run-1",
    name: "Legacy DMZ",
    range: "172.16.8.1 - 172.16.8.32",
    startedAt: "2026-10-21 09:05",
    by: "sam.ops",
    mode: "Instant",
    status: "Failed",
    discover: ["User Keys", "Host Keys"],
    hostsScanned: 32,
    hostsReached: 0,
    userKeys: 0,
    hostKeys: 0,
    pgpKeys: 0,
    keyGroup: "Default_Key_Group",
    inventoryAction: "Monitor",
  },
];

export const SEED_SCHEDULES: DiscoverySchedule[] = [
  {
    id: "sch-1",
    name: "Finance network sweep",
    range: "10.20.4.1 - 10.20.4.254",
    frequency: "Daily",
    time: "06:00",
    nextRun: "2026-10-31 06:00",
    discover: ["User Keys", "Host Keys", "PGP Keys"],
    enabled: true,
    by: "sam.ops",
  },
  {
    id: "sch-2",
    name: "Production weekly",
    range: "10.10.0.1 - 10.10.3.254",
    frequency: "Weekly",
    time: "02:00",
    nextRun: "2026-11-02 02:00",
    discover: ["User Keys", "Host Keys"],
    enabled: true,
    by: "admin",
  },
];

export const SEED_INFRA_GROUPS: InfraAccessGroup[] = [
  { name: "Linux-Prod", description: "Production Linux servers", hosts: 64, createdBy: "admin" },
  {
    name: "Payments-SFTP",
    description: "SFTP gateways for partner file exchange",
    hosts: 4,
    createdBy: "sam.ops",
  },
  { name: "Build-Farm", description: "CI runners and build hosts", hosts: 12, createdBy: "admin" },
];

export const HOST_GROUPS: HostGroup[] = [
  {
    name: "Default_Host_Group",
    description: "Hosts not assigned to another group",
    policy: "Default_Host_Policy",
  },
  { name: "Prod_Host_Group", description: "Production servers", policy: "Default_Host_Policy" },
  { name: "DMZ_Host_Group", description: "Internet-facing hosts", policy: "DMZ_Host_Policy" },
];

export const DATACENTERS = ["absecon", "chennai-dc", "frankfurt-dc"];

export function ipToNumber(ip: string): number | null {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}
