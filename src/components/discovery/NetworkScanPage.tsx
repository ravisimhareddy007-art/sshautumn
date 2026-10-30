import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CheckRow,
  FormActions,
  FormCard,
  FormRow,
  FormSection,
  FreeTagInput,
  PillSwitch,
  PrimaryButton,
  RadioGroupRow,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
  WarningBox,
} from "@/components/common/ProductForm";
import {
  DATACENTERS,
  HOST_GROUPS,
  ipToNumber,
  type DiscoverTarget,
  type DiscoveryRun,
  type DiscoverySchedule,
} from "@/data/discovery";
import { PGP_GROUPS } from "@/data/pgp";
import { startNetworkScan, usePgp } from "@/lib/pgp-store";

type ScanType = "Default" | "Full" | "Directory";

export function NetworkScanPage() {
  const s = usePgp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"Instant" | "Scheduled">("Instant");
  const [frequency, setFrequency] = useState<DiscoverySchedule["frequency"]>("Daily");
  const [time, setTime] = useState("06:00");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startIp, setStartIp] = useState("");
  const [endIp, setEndIp] = useState("");
  const [batch, setBatch] = useState("128");
  const [port, setPort] = useState("22");
  const [accessType, setAccessType] = useState<"Key" | "Certificate">("Certificate");
  const [datacenter, setDatacenter] = useState(DATACENTERS[0]);
  const [credentialType, setCredentialType] = useState("Manual Entry");
  const [loginType, setLoginType] = useState<"Password" | "Identity Key">("Password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identityKey, setIdentityKey] = useState("avx-discovery-ed25519");
  const [vaultAccount, setVaultAccount] = useState("");
  const [sudo, setSudo] = useState(false);
  const [discover, setDiscover] = useState<Record<DiscoverTarget, boolean>>({
    "User Keys": true,
    "Host Keys": true,
    "PGP Keys": false,
  });
  const [pgpPaths, setPgpPaths] = useState<string[]>(s.discovery.paths);
  const [infraGroups, setInfraGroups] = useState<string[]>([]);
  const [hostGroup, setHostGroup] = useState(HOST_GROUPS[0].name);
  const [keyGroup, setKeyGroup] = useState("Default_Key_Group");
  const [scanType, setScanType] = useState<ScanType>("Default");
  const [directory, setDirectory] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [intensive, setIntensive] = useState(false);
  const [inventoryAction, setInventoryAction] = useState<DiscoveryRun["inventoryAction"]>("Manage");
  const [submitted, setSubmitted] = useState(false);

  const e: Record<string, string> = {};
  if (!name.trim()) e.name = "Enter a discovery name";
  const a = ipToNumber(startIp);
  const b = ipToNumber(endIp);
  if (a === null) e.startIp = "Enter a valid IPv4 address";
  if (b === null) e.endIp = "Enter a valid IPv4 address";
  else if (a !== null && b < a) e.endIp = "End IP must not come before Start IP";
  else if (a !== null && b - a > 65535) e.endIp = "A range can cover at most 65,536 addresses";
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)
    e.port = "Enter a port from 1 to 65535";
  if (credentialType === "Manual Entry") {
    if (!username.trim()) e.username = "Enter the username";
    if (loginType === "Password" && !password) e.password = "Enter the password";
  } else if (!vaultAccount.trim()) e.vaultAccount = "Enter the CyberArk account name";
  const targets = (Object.keys(discover) as DiscoverTarget[]).filter((k) => discover[k]);
  if (!targets.length) e.discover = "Select at least one item to discover";
  if (discover["PGP Keys"] && !pgpPaths.length) e.pgpPaths = "Add at least one path";
  if (!infraGroups.length) e.infraGroups = "Select or create an infra access group";
  if (scanType === "Directory" && !directory.trim()) e.directory = "Enter the directory to scan";
  const err = (k: string) => (submitted ? e[k] : undefined);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(e).length) {
      toast.error("Fix the highlighted fields before starting discovery.");
      return;
    }
    startNetworkScan({
      mode,
      name: name.trim(),
      startIp: startIp.trim(),
      endIp: endIp.trim(),
      discover: targets,
      pgpPaths,
      infraGroups,
      keyGroup,
      inventoryAction,
      frequency,
      time,
    });
    if (mode === "Scheduled") {
      toast.success(`"${name.trim()}" scheduled ${frequency.toLowerCase()} at ${time}.`);
      navigate({ to: "/discovery/scheduler" });
    } else {
      toast.success(`Discovery "${name.trim()}" started.`);
      navigate({ to: "/discovery/status" });
    }
  };

  return (
    <div>
      <PageHeader title="Network Scan · IP Range" />
      <FormCard>
        <FormSection title="Discover By">
          <FormRow label="Select" required>
            <RadioGroupRow
              name="Discover By"
              value={mode}
              onChange={setMode}
              options={[
                { value: "Instant", label: "Instant" },
                { value: "Scheduled", label: "Scheduled" },
              ]}
            />
          </FormRow>
          {mode === "Scheduled" && (
            <>
              <FormRow label="Frequency" required>
                <SelectInput
                  value={frequency}
                  onChange={(v) => setFrequency(v as DiscoverySchedule["frequency"])}
                  options={["Daily", "Weekly", "Monthly"]}
                  ariaLabel="Frequency"
                />
              </FormRow>
              <FormRow label="Start Time" required>
                <TextInput type="time" value={time} onChange={setTime} ariaLabel="Start Time" />
              </FormRow>
            </>
          )}
        </FormSection>

        <FormSection title="Discover SSH Keys">
          <FormRow label="Discovery Name" required error={err("name")}>
            <TextInput
              value={name}
              onChange={setName}
              placeholder="e.g. Finance network sweep"
              invalid={!!err("name")}
              ariaLabel="Discovery Name"
            />
          </FormRow>
          <FormRow label="Description">
            <TextArea value={description} onChange={setDescription} ariaLabel="Description" />
          </FormRow>
          <FormRow label="Start IP" required error={err("startIp")}>
            <TextInput
              value={startIp}
              onChange={setStartIp}
              placeholder="Example: 192.168.1.1"
              invalid={!!err("startIp")}
              ariaLabel="Start IP"
            />
          </FormRow>
          <FormRow label="End IP" required error={err("endIp")}>
            <TextInput
              value={endIp}
              onChange={setEndIp}
              placeholder="Example: 192.168.1.4"
              invalid={!!err("endIp")}
              ariaLabel="End IP"
            />
          </FormRow>
          <FormRow
            label="Ip(s) Per Batch"
            required
            info="How many addresses are scanned at the same time. Lower values put less load on the network."
          >
            <SelectInput
              value={batch}
              onChange={setBatch}
              options={["32", "64", "128", "256"]}
              ariaLabel="Ip(s) Per Batch"
            />
          </FormRow>
          <FormRow label="Port" required error={err("port")}>
            <TextInput value={port} onChange={setPort} invalid={!!err("port")} ariaLabel="Port" />
          </FormRow>
          <FormRow label="Access Type" required>
            <RadioGroupRow
              name="Access Type"
              value={accessType}
              onChange={setAccessType}
              options={[
                { value: "Key", label: "Key" },
                { value: "Certificate", label: "Certificate" },
              ]}
            />
          </FormRow>
          <FormRow
            label="DataCenter"
            required
            info="The AppViewX gateway in this datacenter runs the scan."
          >
            <SelectInput
              value={datacenter}
              onChange={setDatacenter}
              options={DATACENTERS}
              ariaLabel="DataCenter"
            />
          </FormRow>
          <FormRow label="Credential Type" required>
            <SelectInput
              value={credentialType}
              onChange={setCredentialType}
              options={["Manual Entry", "CyberArk"]}
              ariaLabel="Credential Type"
            />
          </FormRow>
          {credentialType === "Manual Entry" ? (
            <>
              <FormRow label="Login Type" required>
                <RadioGroupRow
                  name="Login Type"
                  value={loginType}
                  onChange={setLoginType}
                  options={[
                    { value: "Password", label: "Password" },
                    { value: "Identity Key", label: "Identity Key" },
                  ]}
                />
              </FormRow>
              <FormRow label="Username" required error={err("username")}>
                <TextInput
                  value={username}
                  onChange={setUsername}
                  placeholder="Username"
                  invalid={!!err("username")}
                  ariaLabel="Username"
                />
              </FormRow>
              {loginType === "Password" ? (
                <FormRow label="Password" required error={err("password")}>
                  <TextInput
                    type="password"
                    value={password}
                    onChange={setPassword}
                    invalid={!!err("password")}
                    ariaLabel="Password"
                  />
                </FormRow>
              ) : (
                <FormRow label="Identity Key" required>
                  <SelectInput
                    value={identityKey}
                    onChange={setIdentityKey}
                    options={["avx-discovery-ed25519", "avx-discovery-rsa"]}
                    ariaLabel="Identity Key"
                  />
                </FormRow>
              )}
            </>
          ) : (
            <FormRow
              label="Account Name"
              required
              error={err("vaultAccount")}
              hint="The account is fetched from the CyberArk safe set in the key policy."
            >
              <TextInput
                value={vaultAccount}
                onChange={setVaultAccount}
                invalid={!!err("vaultAccount")}
                ariaLabel="Account Name"
              />
            </FormRow>
          )}
          <FormRow label="Sudoer User">
            <CheckRow
              items={[{ label: "Use sudo/administrator access", checked: sudo, onChange: setSudo }]}
            />
            {!sudo && (
              <WarningBox>
                If no sudo/ administrator access is provided, it will result in incomplete SSH key
                discovery and cause Access Control not to be set-up for the hosts.
              </WarningBox>
            )}
          </FormRow>
          <FormRow
            label="Discover"
            required
            error={err("discover")}
            hint="PGP Keys is off by default on existing discovery configurations."
          >
            <CheckRow
              items={(["User Keys", "Host Keys", "PGP Keys"] as DiscoverTarget[]).map((t) => ({
                label: t,
                checked: discover[t],
                onChange: (v: boolean) => setDiscover((d) => ({ ...d, [t]: v })),
              }))}
            />
          </FormRow>
          {discover["PGP Keys"] && (
            <FormRow
              label="PGP Key Paths"
              required
              error={err("pgpPaths")}
              hint="Every OS user's GnuPG home is always scanned. Add other folders or files where keys are kept. Wildcards are allowed."
            >
              <FreeTagInput
                values={pgpPaths}
                onChange={setPgpPaths}
                placeholder="/srv/transfer/keys"
                mono
                ariaLabel="PGP Key Paths"
                invalid={!!err("pgpPaths")}
              />
            </FormRow>
          )}
          <FormRow
            label="Infra Access Group"
            required
            error={err("infraGroups")}
            hint="Application Infra Access Group(s) the onboarded hosts map to. To add a new group name, type it and press enter."
          >
            <FreeTagInput
              values={infraGroups}
              onChange={setInfraGroups}
              suggestions={s.infraGroups.map((g) => g.name)}
              ariaLabel="Infra Access Group"
              invalid={!!err("infraGroups")}
            />
          </FormRow>
          <FormRow
            label="Host Compliance Group"
            info="Discovered hosts are added to this group and checked against its host policy."
          >
            <SelectInput
              value={hostGroup}
              onChange={setHostGroup}
              options={HOST_GROUPS.map((g) => g.name)}
              ariaLabel="Host Compliance Group"
            />
          </FormRow>
          <FormRow
            label="Key Compliance Group"
            info="Discovered keys are added to this group and checked against its key policy."
          >
            <SelectInput
              value={keyGroup}
              onChange={setKeyGroup}
              options={PGP_GROUPS}
              ariaLabel="Key Compliance Group"
            />
          </FormRow>
          <FormRow
            label="Scan Type"
            required
            info="Default scans the standard key locations. Full scans the whole file system. Directory scans only the folder you enter."
          >
            <RadioGroupRow
              name="Scan Type"
              value={scanType}
              onChange={setScanType}
              options={[
                { value: "Default", label: "Default" },
                { value: "Full", label: "Full" },
                { value: "Directory", label: "Directory" },
              ]}
            />
          </FormRow>
          {scanType === "Directory" && (
            <FormRow label="Directory" required error={err("directory")}>
              <TextInput
                value={directory}
                onChange={setDirectory}
                placeholder="/opt/app/keys"
                invalid={!!err("directory")}
                ariaLabel="Directory"
              />
            </FormRow>
          )}
          <FormRow label="Recursive Scan" info="Also scans the folders inside each scanned folder.">
            <PillSwitch value={recursive} onChange={setRecursive} label="Recursive Scan" />
          </FormRow>
          <FormRow
            label="Intensive Scan"
            info="Reads every file to find keys stored under unusual names. Takes longer."
          >
            <PillSwitch value={intensive} onChange={setIntensive} label="Intensive Scan" />
          </FormRow>
          <FormRow
            label="Inventory Action"
            required
            info="Manage adds keys to the inventory for lifecycle actions. Monitor only reports them. Do Not Move leaves keys in Discovery Status."
          >
            <RadioGroupRow
              name="Inventory Action"
              value={inventoryAction}
              onChange={setInventoryAction}
              options={[
                { value: "Do Not Move", label: "Do Not Move" },
                { value: "Manage", label: "Manage" },
                { value: "Monitor", label: "Monitor" },
              ]}
            />
          </FormRow>
        </FormSection>

        <FormActions>
          <PrimaryButton onClick={submit}>
            {mode === "Scheduled" ? "Schedule" : "Discover"}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate({ to: "/discovery/status" })}>
            Cancel
          </SecondaryButton>
        </FormActions>
      </FormCard>
    </div>
  );
}
