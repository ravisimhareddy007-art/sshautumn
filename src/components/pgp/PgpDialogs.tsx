import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CURRENT_USER,
  fmtDate,
  groupedFp,
  PGP_GROUPS,
  PGP_HOSTS,
  rel,
  type OwnKey,
  type Subkey,
  type TrustedKey,
} from "@/data/pgp";
import {
  algoAllowed,
  algoLabel,
  hasWeak,
  isUsable,
  policyFor,
  subkeyStatus,
} from "@/lib/pgp-rules";
import {
  armoredPublic,
  createRevCert,
  decide,
  deleteOwn,
  distribute,
  downloadText,
  extendExpiry,
  fileSafe,
  importKey,
  keyName,
  linkReplacement,
  logOwnOp,
  lookupKey,
  onboard,
  parseArmored,
  removeTrustedFromHosts,
  retireOwn,
  revokeOwn,
  rotateSubkey,
  usePgp,
  type ImportInput,
  type RunResult,
} from "@/lib/pgp-store";
import { cn } from "@/lib/utils";

function Shell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[88vh] overflow-y-auto",
          wide ? "sm:max-w-[720px]" : "sm:max-w-[540px]",
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription asChild>
              <div className="text-[14px]">{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 text-[14px]">{children}</div>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[13px] font-medium mb-1">{label}</div>
      {children}
      {hint && <div className="text-[12px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-risk-red/30 bg-risk-red/5 text-[#991B1B]"
      : tone === "warn"
        ? "border-risk-amber/40 bg-risk-amber/10 text-[#92400E]"
        : "border-primary/20 bg-primary/5 text-foreground";
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div className={cn("flex gap-2 rounded border px-3 py-2 text-[13px]", cls)}>
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Opt({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <RadioGroupItem value={value} className="mt-0.5" />
      <span>
        <span className="text-[14px]">{label}</span>
        {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

const locCount = (k: OwnKey) => k.privateLocations.length + k.publicCopies.length;

// ─── Onboard ───────────────────────────────────────────────────────────────────

export function OnboardDialog({ k, onClose }: { k: OwnKey | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [store, setStore] = useState("hosts");
  const [pass, setPass] = useState("");
  useEffect(() => {
    setNote("");
    setStore("hosts");
    setPass("");
  }, [k?.id]);
  if (!k) return null;
  const readable = k.privateLocations.some((l) => l.read === "Read" && l.heldIn !== "Smart card");
  const ok = note.trim().length > 0 && (store === "hosts" || pass.length > 0);
  return (
    <Shell
      open
      onClose={onClose}
      title={`Onboard ${keyName(k)}`}
      description="Bring a discovered key under AppViewX management so lifecycle actions become available."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              onboard(k.id, note.trim(), store === "appviewx");
              toast.success(`${keyName(k)} is now managed`);
              onClose();
            }}
          >
            Onboard
          </Button>
        </>
      }
    >
      <Field label="How you confirmed who owns this key" hint="Recorded on the key for audit.">
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: confirmed with the treasury team lead that this key encrypts payment files to the bank"
        />
      </Field>
      <Field label="Private key">
        <RadioGroup value={store} onValueChange={setStore} className="space-y-2">
          <Opt
            value="hosts"
            label="Keep it on the hosts only"
            hint="AppViewX tracks the key. Provision and Download Private Key stay unavailable."
          />
          {readable ? (
            <Opt
              value="appviewx"
              label="Also store it in AppViewX"
              hint="Reads the private key from the first readable location. Needs the key's passphrase."
            />
          ) : (
            <div className="text-[12px] text-muted-foreground pl-6">
              The private key cannot be read from any location, so it can only stay on the hosts.
            </div>
          )}
        </RadioGroup>
      </Field>
      {store === "appviewx" && (
        <Field label="Passphrase">
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </Field>
      )}
    </Shell>
  );
}

// ─── Extend Expiry ─────────────────────────────────────────────────────────────

export function ExtendExpiryDialog({ keys, onClose }: { keys: OwnKey[]; onClose: () => void }) {
  const s = usePgp();
  const [scope, setScope] = useState<"both" | "primary" | "subkeys">("both");
  const [days, setDays] = useState("365");
  useEffect(() => {
    setScope("both");
    setDays("365");
  }, [keys.map((k) => k.id).join()]);
  if (!keys.length) return null;
  const n = Number(days);
  const warnings: string[] = [];
  for (const k of keys) {
    const p = policyFor(k.group, s.policies);
    if (scope !== "subkeys" && p.maxValidityPrimary !== null && n > p.maxValidityPrimary)
      warnings.push(
        `${keyName(k)}: primary key validity is over ${p.maxValidityPrimary} days allowed by ${p.name}`,
      );
    if (scope !== "primary" && p.maxValiditySubkeys !== null && n > p.maxValiditySubkeys)
      warnings.push(
        `${keyName(k)}: subkey validity is over ${p.maxValiditySubkeys} days allowed by ${p.name}`,
      );
  }
  const smartCard = keys.filter((k) => k.privateLocations.some((l) => l.heldIn === "Smart card"));
  const valid = Number.isFinite(n) && n >= 1 && n <= 3650;
  return (
    <Shell
      open
      onClose={onClose}
      title={
        keys.length > 1
          ? `Extend Expiry for ${keys.length} keys`
          : `Extend Expiry for ${keyName(keys[0])}`
      }
      description="Sets a new expiry date. Validity is measured from today."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              extendExpiry(
                keys.map((k) => k.id),
                scope,
                n,
              );
              toast.success(
                `Expiry set to ${fmtDate(rel(n))} on ${keys.length} key${keys.length > 1 ? "s" : ""}`,
              );
              onClose();
            }}
          >
            Extend Expiry
          </Button>
        </>
      }
    >
      <Field label="Apply to">
        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as typeof scope)}
          className="space-y-1.5"
        >
          <Opt value="both" label="Primary key and subkeys" />
          <Opt value="primary" label="Primary key only" />
          <Opt
            value="subkeys"
            label="Subkeys only"
            hint="Revoked and retired subkeys are left as they are."
          />
        </RadioGroup>
      </Field>
      <Field
        label="New validity (days from today)"
        hint={valid ? `New expiry: ${fmtDate(rel(n))}` : "Enter 1 to 3650 days"}
      >
        <Input
          type="number"
          min={1}
          max={3650}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-40"
        />
      </Field>
      {warnings.length > 0 && (
        <Note tone="warn">
          The key will become Non-Compliant:
          <ul className="list-disc pl-4 mt-1">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Note>
      )}
      {smartCard.length > 0 && (
        <Note>Keys on a smart card are updated with the card holder's PIN prompt on the host.</Note>
      )}
      <Note>
        The new expiry is written to every location AppViewX manages. A published copy is marked Out
        of date until you publish again.
      </Note>
    </Shell>
  );
}

// ─── Rotate Subkey ─────────────────────────────────────────────────────────────

export function RotateSubkeyDialog({ k, onClose }: { k: OwnKey | null; onClose: () => void }) {
  const s = usePgp();
  const [sel, setSel] = useState("");
  const candidates = useMemo(
    () => (k ? k.subkeys.filter((x) => !x.revoked && !x.retiredBy) : []),
    [k],
  );
  useEffect(() => {
    setSel(candidates[0]?.id ?? "");
  }, [k?.id]);
  if (!k) return null;
  const p = policyFor(k.group, s.policies);
  const chosen = candidates.find((c) => c.id === sel);
  const newAlgo = chosen
    ? p.rotationAlgorithm === "Ed25519"
      ? chosen.purpose === "Encrypt"
        ? "Cv25519"
        : "Ed25519"
      : p.rotationAlgorithm
    : "";
  return (
    <Shell
      open
      onClose={onClose}
      title={`Rotate Subkey on ${keyName(k)}`}
      description="Adds a new subkey for the same purpose and retires the old one. The primary key and fingerprint stay the same, so partners do not need to re-approve."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              rotateSubkey(k.id, sel);
              toast.success(`${chosen?.purpose} subkey rotated on ${keyName(k)}`);
              onClose();
            }}
          >
            Rotate Subkey
          </Button>
        </>
      }
    >
      <Field label="Subkey to rotate">
        <RadioGroup value={sel} onValueChange={setSel} className="space-y-1.5">
          {candidates.map((c: Subkey) => (
            <Opt
              key={c.id}
              value={c.id}
              label={`${c.purpose} · ${algoLabel(c.algo)}`}
              hint={`${subkeyStatus(c, p.expiringThreshold)}, expires ${c.expires ? fmtDate(c.expires) : "never"}`}
            />
          ))}
        </RadioGroup>
      </Field>
      {chosen && (
        <div className="grid grid-cols-2 gap-3 rounded border border-border p-3 text-[13px]">
          <div>
            <div className="text-muted-foreground text-[12px]">New subkey algorithm</div>
            {newAlgo} <span className="text-muted-foreground">(policy)</span>
          </div>
          <div>
            <div className="text-muted-foreground text-[12px]">New subkey expires</div>
            {fmtDate(rel(p.rotationValidity))}{" "}
            <span className="text-muted-foreground">({p.rotationValidity} days)</span>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground text-[12px]">Updated on</div>
            {locCount(k)} location{locCount(k) === 1 ? "" : "s"}
            {k.publication === "Published" && ". The published copy is marked Out of date."}
          </div>
        </div>
      )}
      <Note>
        The old subkey stays in the key as Retired so files already encrypted to it can still be
        decrypted.
      </Note>
    </Shell>
  );
}

// ─── Revoke ────────────────────────────────────────────────────────────────────

const REASONS = ["Key compromised", "Key superseded", "Key no longer used", "No reason specified"];

export function RevokeDialog({ k, onClose }: { k: OwnKey | null; onClose: () => void }) {
  const [scope, setScope] = useState("key");
  const [reason, setReason] = useState(REASONS[1]);
  const [comment, setComment] = useState("");
  useEffect(() => {
    setScope("key");
    setReason(REASONS[1]);
    setComment("");
  }, [k?.id]);
  if (!k) return null;
  const subs = k.subkeys.filter((x) => !x.revoked);
  const uids = k.userIds.map((u, i) => ({ u, i })).filter(({ u }) => !u.revoked && !u.primary);
  const discovered = k.management === "Discovered";
  return (
    <Shell
      open
      onClose={onClose}
      title={`Revoke ${keyName(k)}`}
      description="Revocation is permanent. A revoked key or subkey cannot be used again."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-risk-red hover:bg-risk-red/90 text-white"
            onClick={() => {
              if (scope === "key") revokeOwn(k.id, { kind: "key" }, reason, comment);
              else if (scope.startsWith("sub:"))
                revokeOwn(k.id, { kind: "subkey", subkeyId: scope.slice(4) }, reason, comment);
              else revokeOwn(k.id, { kind: "uid", index: Number(scope.slice(4)) }, reason, comment);
              toast.success("Revoked. Publish the key so partners see the revocation.");
              onClose();
            }}
          >
            Revoke
          </Button>
        </>
      }
    >
      <Field label="What to revoke">
        <RadioGroup value={scope} onValueChange={setScope} className="space-y-1.5">
          <Opt
            value="key"
            label="The whole key"
            hint={
              k.revCert === "Stored"
                ? `Uses the revocation certificate stored in ${k.revCertWhere}.`
                : discovered
                  ? "Uses the private key on the host."
                  : undefined
            }
          />
          {!discovered &&
            subs.map((x) => (
              <Opt
                key={x.id}
                value={`sub:${x.id}`}
                label={`${x.purpose} subkey · ${algoLabel(x.algo)}`}
              />
            ))}
          {!discovered &&
            uids.map(({ u, i }) => (
              <Opt
                key={i}
                value={`uid:${i}`}
                label={`User ID: ${u.name}${u.email ? ` <${u.email}>` : ""}`}
              />
            ))}
        </RadioGroup>
        {discovered && (
          <div className="text-[12px] text-muted-foreground mt-1">
            Onboard the key to revoke a single subkey or user ID.
          </div>
        )}
      </Field>
      <Field label="Reason">
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Comment (optional)">
        <Input value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      {scope === "key" && locCount(k) > 0 && (
        <Note tone="warn">
          The key stays on {locCount(k)} location(s) and will show the risk Revoked but present
          until you delete it from hosts.
        </Note>
      )}
    </Shell>
  );
}

// ─── Retire ────────────────────────────────────────────────────────────────────

export function RetireDialog({ k, onClose }: { k: OwnKey | null; onClose: () => void }) {
  const [remove, setRemove] = useState(false);
  useEffect(() => setRemove(false), [k?.id]);
  if (!k) return null;
  return (
    <Shell
      open
      onClose={onClose}
      title={`Retire ${keyName(k)}`}
      description="Retire ends the key's use without revoking it. Its usable subkeys are marked Retired. You can reactivate it later."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              retireOwn(k.id, remove);
              toast.success(`${keyName(k)} retired`);
              onClose();
            }}
          >
            Retire
          </Button>
        </>
      }
    >
      <label className="flex items-start gap-2">
        <Checkbox checked={remove} onCheckedChange={(v) => setRemove(!!v)} className="mt-0.5" />
        <span>
          Also remove the key from its {locCount(k)} location{locCount(k) === 1 ? "" : "s"}
          <span className="block text-[12px] text-muted-foreground">
            Leave this off if hosts still need to decrypt older files.
          </span>
        </span>
      </label>
      <Note>
        The private key and revocation certificate stay in{" "}
        {k.storage === "CyberArk" ? "CyberArk" : "AppViewX"}.
      </Note>
    </Shell>
  );
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export function DeleteOwnDialog({
  keys,
  open,
  onClose,
}: {
  keys: OwnKey[];
  open: boolean;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [mode, setMode] = useState<"From Inventory" | "From Hosts">("From Inventory");
  useEffect(() => {
    setTyped("");
    setMode("From Inventory");
  }, [open, keys.length]);
  if (!keys.length || !open) return null;
  const locs = keys.reduce((n, k) => n + locCount(k), 0);
  const fromHosts = mode === "From Hosts";
  const unreachable = fromHosts
    ? keys.flatMap((k) =>
        k.privateLocations
          .filter((l) => l.read === "Inaccessible")
          .map((l) => `${l.host} (${l.osUser})`),
      )
    : [];
  return (
    <Shell
      open
      onClose={onClose}
      title={`Delete ${keys.length > 1 ? `${keys.length} keys` : keyName(keys[0])}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-risk-red hover:bg-risk-red/90 text-white"
            disabled={fromHosts && typed !== "DELETE"}
            onClick={() => {
              deleteOwn(
                keys.map((k) => k.id),
                mode,
              );
              toast.success(
                `${keys.length} key${keys.length > 1 ? "s" : ""} deleted ${mode.toLowerCase()}. See Recently Deleted Keys > PGP Keys.`,
              );
              onClose();
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <Field label="Delete">
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="space-y-2">
          <Opt value="From Inventory" label="From Inventory" hint="Remove the key from AppViewX only. Hosts are not changed." />
          <Opt value="From Hosts" label="From Hosts" hint="Remove the key from every host and from AppViewX." />
        </RadioGroup>
      </Field>
      {fromHosts ? (
        <>
          <Note tone="danger">
            Removes the key from {locs} location{locs === 1 ? "" : "s"} and from the inventory.
            Hosts can no longer decrypt files encrypted to this key.
            {keys.some((k) => k.storage !== "Host only") &&
              " The copy in AppViewX or CyberArk is deleted too."}
          </Note>
          {unreachable.length > 0 && (
            <Note tone="warn">
              Could not read {unreachable.join(", ")}. Those copies may remain and will be found by
              the next discovery.
            </Note>
          )}
          <Field label="Type DELETE to confirm">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-40" />
          </Field>
        </>
      ) : (
        <Note>
          Removes the key from the AppViewX inventory only. Nothing changes on hosts, so discovery
          finds it again as a Discovered key while it is still on a host.
        </Note>
      )}
    </Shell>
  );
}

// ─── Download Private Key ──────────────────────────────────────────────────────

export function DownloadPrivateDialog({ k, onClose }: { k: OwnKey | null; onClose: () => void }) {
  const [why, setWhy] = useState("");
  useEffect(() => setWhy(""), [k?.id]);
  if (!k) return null;
  return (
    <Shell
      open
      onClose={onClose}
      title={`Download private key for ${keyName(k)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!why.trim()}
            onClick={() => {
              downloadText(
                `${fileSafe(keyName(k))}-secret.asc`,
                `-----BEGIN PGP PRIVATE KEY BLOCK-----\nComment: Prototype placeholder, no key material\n\n${k.primary.fingerprint}\n-----END PGP PRIVATE KEY BLOCK-----\n`,
              );
              logOwnOp(k.id, "Download Private Key", why.trim());
              toast.success("Private key downloaded. It stays protected by its passphrase.");
              onClose();
            }}
          >
            Download
          </Button>
        </>
      }
    >
      <Note tone="warn">
        The file is protected by the key's passphrase. Every download is recorded with your name and
        reason.
      </Note>
      <Field label="Reason">
        <Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      </Field>
    </Shell>
  );
}

// ─── Trusted: Import Key ───────────────────────────────────────────────────────

type ImportSource =
  | "File"
  | "Paste"
  | "Keyserver"
  | "Web Key Directory"
  | "Already in Trusted Keys";

export function ImportKeyDialog({
  open,
  replacing,
  onClose,
}: {
  open: boolean;
  replacing?: TrustedKey | null;
  onClose: () => void;
}) {
  const s = usePgp();
  const [source, setSource] = useState<ImportSource>("File");
  const [type, setType] = useState<"Partner" | "Repository">("Partner");
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState("Default_Key_Group");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportInput["data"] | null>(null);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState("");
  const candidates = replacing
    ? s.trusted.filter(
        (k) =>
          k.type === "Partner" &&
          k.id !== replacing.id &&
          !k.replaces &&
          !k.replacedBy &&
          !k.primary.revoked,
      )
    : [];

  useEffect(() => {
    if (!open) return;
    setExisting("");
    setSource("File");
    setType("Partner");
    setLabel(replacing ? `${replacing.label ?? keyName(replacing)} (new)` : "");
    setGroup(replacing?.group ?? "Default_Key_Group");
    setText("");
    setEmail(replacing?.userIds[0]?.email ?? "");
    setFileName("");
    setParsed(null);
    setError("");
  }, [open, replacing?.id]);

  const reset = () => {
    setParsed(null);
    setError("");
  };
  const p = policyFor(group, s.policies);

  const checks = parsed
    ? [
        {
          ok: algoAllowed(parsed.primary.algo, p),
          label: `Algorithm ${algoLabel(parsed.primary.algo)} ${algoAllowed(parsed.primary.algo, p) ? "is allowed" : `is not allowed by ${p.name}`}`,
        },
        {
          ok: parsed.primary.expires !== null,
          label: parsed.primary.expires
            ? `Expires ${fmtDate(parsed.primary.expires)}`
            : "No expiry set",
        },
        {
          ok: !hasWeak({ ...parsed, kind: "trusted" } as unknown as TrustedKey),
          label: hasWeak({ ...parsed, kind: "trusted" } as unknown as TrustedKey)
            ? "Weak algorithm"
            : "No weak algorithm",
        },
        { ok: !parsed.primary.revoked, label: parsed.primary.revoked ? "Revoked" : "Not revoked" },
      ]
    : [];

  const parse = () => {
    reset();
    if (source === "File" || source === "Paste") {
      if (!text.trim()) return setError(source === "File" ? "Choose a file" : "Paste a public key");
      const r = parseArmored(text, label || fileName.replace(/\.(asc|gpg|pub)$/i, ""));
      if ("error" in r) return setError(r.error);
      return check(r);
    }
    if (source === "Keyserver" && !s.settings.keyserver)
      return setError("No keyserver is set. Add one in Administration > PGP Settings.");
    const r = lookupKey(email);
    if (!r)
      return setError(
        `No key found for ${email} ${source === "Keyserver" ? `on ${s.settings.keyserver}` : "in the domain's Web Key Directory"}`,
      );
    check(clone(r));
  };
  const check = (r: ImportInput["data"]) => {
    if (s.trusted.some((k) => k.primary.fingerprint === r.primary.fingerprint))
      return setError("This key is already in the Trusted Keys inventory.");
    if (s.own.some((k) => k.primary.fingerprint === r.primary.fingerprint))
      return setError("This is one of your own keys.");
    setParsed(r);
    if (!label) setLabel(r.userIds[0]?.name ?? "");
  };

  const doImport = () => {
    if (!parsed) return;
    const k = importKey({
      type: replacing ? "Partner" : type,
      label,
      group,
      source: source as TrustedKey["source"],
      data: parsed,
      replaces: replacing?.id,
    });
    if (k.approval === "Pending")
      toast.success("Imported. Waiting for a second person to approve it.");
    else
      toast.success(
        type === "Repository"
          ? "Imported. Add it to Approved Repository Keys to trust it."
          : "Imported and approved. Approval is not required by policy.",
      );
    onClose();
  };

  return (
    <Shell
      open={open}
      onClose={onClose}
      wide
      title={replacing ? `Replace ${keyName(replacing)}` : "Import Key"}
      description={
        replacing
          ? "Import the partner's new key. The old key stays in place until you confirm the cutover."
          : "Add a partner's public key or a repository signing key."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {source === "Already in Trusted Keys" ? (
            <Button
              disabled={!existing}
              onClick={() => {
                if (!replacing) return;
                linkReplacement(replacing.id, existing);
                toast.success("Replacement set. Distribute the new key, then confirm the cutover.");
                onClose();
              }}
            >
              Use as replacement
            </Button>
          ) : parsed ? (
            <Button onClick={doImport} disabled={!label.trim()}>
              Import
            </Button>
          ) : (
            <Button onClick={parse}>
              {source === "File" || source === "Paste" ? "Read key" : "Look up"}
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {!replacing && (
          <Field label="Key type">
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as typeof type)}
              className="flex gap-4"
            >
              <Opt value="Partner" label="Partner key" />
              <Opt value="Repository" label="Repository key" />
            </RadioGroup>
          </Field>
        )}
        <Field label="Key group">
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PGP_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Source">
        <RadioGroup
          value={source}
          onValueChange={(v) => {
            setSource(v as ImportSource);
            reset();
          }}
          className="flex gap-4"
        >
          {(["File", "Paste", "Keyserver", "Web Key Directory"] as const).map((x) => (
            <Opt key={x} value={x} label={x} />
          ))}
          {replacing && <Opt value="Already in Trusted Keys" label="Already in Trusted Keys" />}
        </RadioGroup>
      </Field>
      {source === "Already in Trusted Keys" && (
        <Field
          label="New key"
          hint="Partner keys already imported, for example one a colleague imported and approved."
        >
          {candidates.length ? (
            <RadioGroup value={existing} onValueChange={setExisting} className="space-y-1.5">
              {candidates.map((c) => (
                <Opt
                  key={c.id}
                  value={c.id}
                  label={keyName(c)}
                  hint={`${c.approval} · ${algoLabel(c.primary.algo)} · expires ${c.primary.expires ? fmtDate(c.primary.expires) : "never"} · ${groupedFp(c.primary.fingerprint)}`}
                />
              ))}
            </RadioGroup>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              No other partner keys are available.
            </div>
          )}
        </Field>
      )}
      {source === "File" && (
        <Field label="Public key file" hint="An armored .asc or binary .gpg public key.">
          <Input
            type="file"
            accept=".asc,.gpg,.pub,.txt"
            onChange={async (e) => {
              reset();
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              setText(await f.text());
            }}
          />
        </Field>
      )}
      {source === "Paste" && (
        <Field label="Public key">
          <Textarea
            rows={5}
            className="font-mono text-[12px]"
            value={text}
            onChange={(e) => (setText(e.target.value), reset())}
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
          />
        </Field>
      )}
      {(source === "Keyserver" || source === "Web Key Directory") && (
        <Field
          label="Email address"
          hint={
            source === "Keyserver"
              ? s.settings.keyserver
                ? `Searches ${s.settings.keyserver}`
                : "No keyserver set in PGP Settings"
              : "Looks up the key on the email domain's Web Key Directory."
          }
        >
          <Input
            value={email}
            onChange={(e) => (setEmail(e.target.value), reset())}
            placeholder="files@novapay.example"
          />
        </Field>
      )}
      {error && <Note tone="danger">{error}</Note>}
      {parsed && (
        <div className="rounded border border-border p-3 space-y-3">
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div>
            <div className="text-[12px] text-muted-foreground">Fingerprint</div>
            <div className="font-mono text-[14px] tracking-wide">
              {groupedFp(parsed.primary.fingerprint)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-[12px] text-muted-foreground">User IDs</div>
              {parsed.userIds.map((u, i) => (
                <div key={i}>
                  {u.name}{" "}
                  {u.email && <span className="text-muted-foreground">&lt;{u.email}&gt;</span>}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">Subkeys</div>
              {parsed.subkeys.map((x) => (
                <div key={x.id}>
                  {x.purpose} · {algoLabel(x.algo)}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-muted-foreground mb-1">Policy check ({p.name})</div>
            <ul className="space-y-0.5 text-[13px]">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  {c.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-risk-green" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-risk-red" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          {(replacing || type === "Partner") &&
            (p.requireApproval ? (
              <Note>
                Confirm this fingerprint with the partner over a separate channel, such as a phone
                call. A second person must approve the key before it can be distributed.
              </Note>
            ) : (
              <Note>
                The policy does not require approval for partner keys, so the key is approved on
                import.
              </Note>
            ))}
        </div>
      )}
    </Shell>
  );
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ─── Trusted: Approve or Reject ────────────────────────────────────────────────

export function DecideDialog({ k, onClose }: { k: TrustedKey | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [k?.id]);
  if (!k) return null;
  const act = (d: "Approved" | "Rejected") => {
    decide(k.id, d, note.trim());
    toast.success(
      d === "Approved"
        ? `${keyName(k)} approved. You can now distribute it.`
        : `${keyName(k)} rejected`,
    );
    onClose();
  };
  return (
    <Shell
      open
      onClose={onClose}
      title={`Approve or Reject ${keyName(k)}`}
      description={`Imported by ${k.imported?.by ?? "discovery"} on ${fmtDate(k.imported?.at)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-risk-red border-risk-red/40"
            disabled={!note.trim()}
            onClick={() => act("Rejected")}
          >
            Reject
          </Button>
          <Button disabled={!note.trim()} onClick={() => act("Approved")}>
            Approve
          </Button>
        </>
      }
    >
      <div>
        <div className="text-[12px] text-muted-foreground">
          Fingerprint to confirm with the partner
        </div>
        <div className="font-mono text-[15px] tracking-wide mt-1">
          {groupedFp(k.primary.fingerprint)}
        </div>
      </div>
      <div className="text-[13px]">
        {k.userIds.map((u, i) => (
          <div key={i}>
            {u.name} {u.email && <span className="text-muted-foreground">&lt;{u.email}&gt;</span>}
          </div>
        ))}
      </div>
      {k.policyCheck && <Note>Policy check at import: {k.policyCheck.join(" · ")}</Note>}
      <Field
        label="How you confirmed the fingerprint"
        hint={`Recorded with your name (${CURRENT_USER}).`}
      >
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: read back by phone with ClearCard operations"
        />
      </Field>
    </Shell>
  );
}

// ─── Trusted: Distribute ───────────────────────────────────────────────────────

export function DistributeDialog({ k, onClose }: { k: TrustedKey | null; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const s = usePgp();
  const replaced = k?.replaces ? s.trusted.find((x) => x.id === k.replaces) : undefined;
  useEffect(() => {
    setResults(null);
    setRunning(false);
    setPicked(replaced ? replaced.locations.map((l) => `${l.host}|${l.osUser}`) : []);
  }, [k?.id]);
  if (!k) return null;
  const combos = PGP_HOSTS.flatMap((h) =>
    h.users.map((u) => ({
      host: h.name,
      osUser: u,
      present: k.locations.some((l) => l.host === h.name && l.osUser === u),
    })),
  );
  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const res = distribute(
        k.id,
        picked.map((p) => {
          const [host, osUser] = p.split("|");
          return { host, osUser };
        }),
      );
      setResults(res);
      setRunning(false);
      const bad = res.filter((r) => r.outcome === "Failed").length;
      if (bad) toast.error(`${bad} location${bad > 1 ? "s" : ""} failed`);
      else toast.success("Key distributed");
    }, 700);
  };
  return (
    <Shell
      open
      onClose={onClose}
      wide
      title={`Distribute ${keyName(k)}`}
      description="Places the public key in the keyring of each selected OS user."
      footer={
        results ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!picked.length || running} onClick={run}>
              {running && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Distribute
            </Button>
          </>
        )
      }
    >
      {replaced && !results && (
        <Note>
          Preselected: every location that has {keyName(replaced)}, so the cutover can be confirmed.
        </Note>
      )}
      {!results ? (
        <div className="max-h-[320px] overflow-y-auto rounded border border-border">
          <table className="w-full text-[13px]">
            <tbody>
              {combos.map((c) => {
                const id = `${c.host}|${c.osUser}`;
                return (
                  <tr key={id} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 w-8">
                      <Checkbox
                        disabled={c.present}
                        checked={c.present || picked.includes(id)}
                        onCheckedChange={(v) =>
                          setPicked((p) => (v ? [...p, id] : p.filter((x) => x !== id)))
                        }
                      />
                    </td>
                    <td className="py-1.5">{c.host}</td>
                    <td className="py-1.5">{c.osUser}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {c.present ? "Already present" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ResultList results={results} />
      )}
    </Shell>
  );
}

export function ResultList({ results }: { results: RunResult[] }) {
  return (
    <ul className="space-y-1 text-[13px]">
      {results.map((r, i) => (
        <li key={i} className="flex items-center gap-2">
          {r.outcome === "Succeeded" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-risk-green" />
          ) : r.outcome === "Skipped" ? (
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-risk-red" />
          )}
          <span className="font-medium">
            {r.dest.host} / {r.dest.osUser}
          </span>
          <span className="text-muted-foreground">{r.dest.role}</span>
          <span className={cn(r.outcome === "Failed" ? "text-risk-red" : "text-muted-foreground")}>
            {r.outcome === "Succeeded" ? "Placed" : `${r.outcome}: ${r.reason}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Trusted: Remove from Hosts ────────────────────────────────────────────────

export function RemoveFromHostsDialog({
  k,
  onClose,
}: {
  k: TrustedKey | null;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked(k ? k.locations.map((l) => `${l.host}|${l.osUser}`) : []), [k?.id]);
  if (!k) return null;
  return (
    <Shell
      open
      onClose={onClose}
      title={`Remove ${keyName(k)} from hosts`}
      description="The key stays in the inventory. Hosts can no longer verify or encrypt with it."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-risk-red hover:bg-risk-red/90 text-white"
            disabled={!picked.length}
            onClick={() => {
              removeTrustedFromHosts(
                k.id,
                picked.map((p) => {
                  const [host, osUser] = p.split("|");
                  return { host, osUser };
                }),
              );
              toast.success(
                `Removed from ${picked.length} location${picked.length > 1 ? "s" : ""}`,
              );
              onClose();
            }}
          >
            Remove
          </Button>
        </>
      }
    >
      {k.type === "Repository" && (
        <Note tone="warn">Packages signed by this key will no longer install on these hosts.</Note>
      )}
      <div className="max-h-[300px] overflow-y-auto rounded border border-border">
        {k.locations.map((l) => {
          const id = `${l.host}|${l.osUser}`;
          return (
            <label
              key={id}
              className="flex items-center gap-2 px-2 py-1.5 border-b border-border last:border-0 text-[13px]"
            >
              <Checkbox
                checked={picked.includes(id)}
                onCheckedChange={(v) =>
                  setPicked((p) => (v ? [...p, id] : p.filter((x) => x !== id)))
                }
              />
              {l.host} / {l.osUser}{" "}
              <span className="text-muted-foreground font-mono text-[12px]">{l.path}</span>
            </label>
          );
        })}
      </div>
    </Shell>
  );
}

// ─── Small confirmations with side effects ─────────────────────────────────────

export function exportPublic(keys: (OwnKey | TrustedKey)[]) {
  if (keys.length === 1) downloadText(`${fileSafe(keyName(keys[0]))}.asc`, armoredPublic(keys[0]));
  else downloadText(`pgp-public-keys-${keys.length}.asc`, keys.map(armoredPublic).join("\n"));
  for (const k of keys) if (k.kind === "own") logOwnOp(k.id, "Export Public Key");
  toast.success(`Exported ${keys.length} public key${keys.length > 1 ? "s" : ""}`);
}

export function exportWkd(k: OwnKey, domain: string) {
  const emails = k.userIds.filter((u) => !u.revoked && u.email).map((u) => u.email as string);
  downloadText(
    `${fileSafe(keyName(k))}-wkd.txt`,
    emails
      .map(
        (e) =>
          `https://openpgpkey.${e.split("@")[1]}/.well-known/openpgpkey/${e.split("@")[1]}/hu/<hash of ${e.split("@")[0]}>\n`,
      )
      .join("") +
      "\n" +
      armoredPublic(k),
  );
  logOwnOp(k.id, "Export for WKD", emails.join(", "));
  toast.success(`WKD files exported for ${emails.join(", ")}${domain ? "" : ""}`);
}

export function createRevCertNow(k: OwnKey) {
  createRevCert(k.id);
  toast.success(
    `Revocation certificate stored in ${k.storage === "CyberArk" ? "CyberArk" : "AppViewX"}`,
  );
}

export const usableCount = (k: OwnKey) => k.subkeys.filter(isUsable).length;
