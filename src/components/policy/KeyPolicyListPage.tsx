import { Fragment, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Pager,
  SearchBox,
  SortHeader,
  toolbarButton,
  useSort,
} from "@/components/common/ListToolbar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteKeyPolicies, usePgp } from "@/lib/pgp-store";
import type { KeyPolicy } from "@/data/pgp";
import { cn } from "@/lib/utils";

const PAGE = 10;

export function KeyPolicyListPage() {
  const s = usePgp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filtered = s.policies.filter((p) =>
    `${p.name} ${p.description} ${p.groups.join(" ")}`
      .toLowerCase()
      .includes(q.trim().toLowerCase()),
  );
  const { sorted, by } = useSort<KeyPolicy>(filtered);
  const rows = sorted.slice((page - 1) * PAGE, page * PAGE);
  const sel = s.policies.filter((p) => selected.includes(p.id));
  const deletingDefault = sel.some((p) => p.id === "pol-default");

  return (
    <div>
      <PageHeader title="Key Policy" />
      <div className="page-card">
        <div className="mb-6 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            className="w-[600px] max-w-[45%]"
          />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => navigate({ to: "/policies/key/new" })}
            >
              <Plus className="h-4 w-4" /> Create policy
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn(toolbarButton, "w-[168px] justify-between")}>
                  <span className="inline-flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" /> Actions
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  disabled={sel.length !== 1}
                  onClick={() =>
                    navigate({ to: "/policies/key/$policyId", params: { policyId: sel[0].id } })
                  }
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!sel.length || deletingDefault}
                  className="text-risk-red focus:text-risk-red"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
          </div>
        </div>

        <div className="inv-frame">
          <div className="inv-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }} />
                  <th style={{ width: 48 }}>
                    <Checkbox
                      aria-label="Select all"
                      checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                      onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  <th>
                    <SortHeader onClick={() => by("name", (r) => r.name.toLowerCase())}>
                      Policy name
                    </SortHeader>
                  </th>
                  <th>Group</th>
                  <th>
                    <SortHeader
                      onClick={() => by("description", (r) => r.description.toLowerCase())}
                    >
                      Description
                    </SortHeader>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <Fragment key={p.id}>
                    <tr className={cn(selected.includes(p.id) && "row-selected")}>
                      <td>
                        <button
                          type="button"
                          aria-label={`Expand ${p.name}`}
                          className="rounded p-1 hover:bg-muted"
                          onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                        >
                          {expanded[p.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td>
                        <Checkbox
                          aria-label={`Select ${p.name}`}
                          checked={selected.includes(p.id)}
                          onCheckedChange={(v) =>
                            setSelected((x) => (v ? [...x, p.id] : x.filter((y) => y !== p.id)))
                          }
                        />
                      </td>
                      <td>
                        <Link
                          to="/policies/key/$policyId"
                          params={{ policyId: p.id }}
                          className="text-[15px] text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        {p.groups.join(", ") || (
                          <span className="text-muted-foreground">No group</span>
                        )}
                      </td>
                      <td>{p.description}</td>
                    </tr>
                    {expanded[p.id] && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            height: "auto",
                            whiteSpace: "normal",
                            maxWidth: "none",
                            background: "#F9FAFB",
                            padding: "14px 24px 14px 110px",
                          }}
                        >
                          <div className="grid grid-cols-4 gap-6 text-[14px]">
                            <Summary label="Key algorithms" value={p.sshAlgorithms.join(", ")} />
                            <Summary
                              label="Vault storage"
                              value={
                                p.storage.mode === "Required" ? "Required: CyberArk" : "Optional"
                              }
                            />
                            <Summary
                              label="PGP evaluation"
                              value={p.evaluatePgp ? `On, ${p.pgpAlgorithms.join(", ")}` : "Off"}
                            />
                            <Summary
                              label="Partner key approval"
                              value={p.requireApproval ? "Required" : "Not required"}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        height: 120,
                        textAlign: "center",
                        maxWidth: "none",
                        color: "#6B7280",
                      }}
                    >
                      No policies match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={
          sel.length > 1 ? `Delete ${sel.length} policies` : `Delete ${sel[0]?.name ?? "policy"}`
        }
        description="Key compliance groups that use this policy move to Default_Key_Policy."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          deleteKeyPolicies(sel.map((p) => p.id));
          toast.success("Policy deleted");
          setSelected([]);
          setConfirmDelete(false);
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] text-[#6B7280]">{label}</div>
      <div className="mt-0.5 text-[#111827]">{value}</div>
    </div>
  );
}
