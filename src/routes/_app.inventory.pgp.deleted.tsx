import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDate, keyIdOf } from "@/data/pgp";
import { keyName, usePgp } from "@/lib/pgp-store";

export const Route = createFileRoute("/_app/inventory/pgp/deleted")({
  component: DeletedPgpKeys,
});

function DeletedPgpKeys() {
  const s = usePgp();
  return (
    <div>
      <PageHeader
        breadcrumbs={["INVENTORY", "PGP KEY INVENTORY", "Recently Deleted PGP Keys"]}
        title="Recently Deleted PGP Keys"
      />
      <div className="inv-frame">
        <div className="inv-scroll">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Kind</th>
                <th>Key ID</th>
                <th>Deleted</th>
                <th>How</th>
                <th>Deleted By</th>
              </tr>
            </thead>
            <tbody>
              {s.deleted.map((d, i) => (
                <tr key={i}>
                  <td className="font-medium">{keyName(d.key)}</td>
                  <td>{d.key.kind === "own" ? "Own key" : `${d.key.type} key`}</td>
                  <td className="font-mono text-[11px]">{keyIdOf(d.key.primary.fingerprint)}</td>
                  <td>{fmtDate(d.deletedAt)}</td>
                  <td>{d.mode === "Cutover" ? "Removed at cutover" : d.mode}</td>
                  <td>{d.by}</td>
                </tr>
              ))}
              {s.deleted.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      height: "auto",
                      textAlign: "center",
                      padding: 48,
                      maxWidth: "none",
                      color: "var(--color-muted-foreground)",
                    }}
                  >
                    No PGP keys have been deleted in this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
