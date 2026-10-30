import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { HeaderTab, PageHeader } from "@/components/layout/PageHeader";
import { Pager, SearchBox, toolbarButton } from "@/components/common/ListToolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DELETED_KEYS } from "@/data/mock";
import { fmtDate, keyIdOf } from "@/data/pgp";
import { algoLabel } from "@/lib/pgp-rules";
import { keyName, usePgp } from "@/lib/pgp-store";

type Search = { tab?: "ssh" | "pgp" };

export const Route = createFileRoute("/_app/inventory/keys/deleted")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "pgp" ? "pgp" : undefined,
  }),
  component: RecentlyDeletedKeys,
});

const PAGE = 25;

function RecentlyDeletedKeys() {
  const { tab = "ssh" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const s = usePgp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const needle = q.trim().toLowerCase();
  const ssh = DELETED_KEYS.filter((k) =>
    `${k.name} ${k.deletedBy} ${k.endpoints.join(" ")}`.toLowerCase().includes(needle),
  );
  const pgp = s.deleted.filter((d) => `${keyName(d.key)} ${d.by}`.toLowerCase().includes(needle));
  const total = tab === "ssh" ? ssh.length : pgp.length;

  return (
    <div>
      <PageHeader
        title="Recently Deleted Keys"
        tabs={
          <>
            <HeaderTab
              active={tab === "ssh"}
              onClick={() => (navigate({ search: {} }), setPage(1))}
            >
              SSH Keys
            </HeaderTab>
            <HeaderTab
              active={tab === "pgp"}
              onClick={() => (navigate({ search: { tab: "pgp" } }), setPage(1))}
            >
              PGP Keys
            </HeaderTab>
          </>
        }
      />
      <div className="page-card">
        <div className="mb-5 flex items-center gap-3">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setPage(1))}
            placeholder="Type your search and press Enter"
            className="w-[420px]"
          />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => toast.success("Exported to CSV.")}
            >
              Export All
            </button>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </div>
        </div>
        <div className="inv-frame">
          <div className="inv-scroll">
            {tab === "ssh" ? (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Key name</th>
                    <th>Encryption</th>
                    <th>Length</th>
                    <th>Deleted On</th>
                    <th>Deleted By</th>
                    <th>Endpoint(s)</th>
                    <th style={{ width: 64 }} />
                  </tr>
                </thead>
                <tbody>
                  {ssh.slice((page - 1) * PAGE, page * PAGE).map((k) => (
                    <tr key={k.id}>
                      <td className="font-medium" title={k.name}>
                        {k.name}
                      </td>
                      <td>{k.encryption}</td>
                      <td>{k.length}</td>
                      <td>{k.deletedOn}</td>
                      <td>{k.deletedBy}</td>
                      <td className="font-mono text-[13px]" title={k.endpoints.join(", ")}>
                        {k.endpoints.join(", ") || "—"}
                      </td>
                      <td>
                        <RowMenu />
                      </td>
                    </tr>
                  ))}
                  {ssh.length === 0 && <EmptyRow cols={7} text="No recently deleted SSH keys." />}
                </tbody>
              </table>
            ) : (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Key name</th>
                    <th>Kind</th>
                    <th>Key ID</th>
                    <th>Algorithm</th>
                    <th>Deleted On</th>
                    <th>How</th>
                    <th>Deleted By</th>
                    <th style={{ width: 64 }} />
                  </tr>
                </thead>
                <tbody>
                  {pgp.slice((page - 1) * PAGE, page * PAGE).map((d, i) => (
                    <tr key={`${d.key.id}-${i}`}>
                      <td className="font-medium">{keyName(d.key)}</td>
                      <td>{d.key.kind === "own" ? "Own key" : `${d.key.type} key`}</td>
                      <td className="font-mono text-[13px]">
                        {keyIdOf(d.key.primary.fingerprint)}
                      </td>
                      <td>{algoLabel(d.key.primary.algo)}</td>
                      <td>{fmtDate(d.deletedAt)}</td>
                      <td>{d.mode === "Cutover" ? "Removed at cutover" : d.mode}</td>
                      <td>{d.by}</td>
                      <td>
                        <RowMenu />
                      </td>
                    </tr>
                  ))}
                  {pgp.length === 0 && <EmptyRow cols={8} text="No recently deleted PGP keys." />}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toast.success("Exported to CSV.")}>
          Export Row
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td
        colSpan={cols}
        style={{ height: 120, textAlign: "center", maxWidth: "none", color: "#6B7280" }}
      >
        {text}
      </td>
    </tr>
  );
}
