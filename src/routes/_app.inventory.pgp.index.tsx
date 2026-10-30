import { createFileRoute } from "@tanstack/react-router";
import { PgpInventoryPage } from "@/components/pgp/PgpInventoryPage";

type Search = { tab?: "own" | "trusted"; tile?: string; window?: number };

export const Route = createFileRoute("/_app/inventory/pgp/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "trusted" ? "trusted" : s.tab === "own" ? "own" : undefined,
    tile: typeof s.tile === "string" ? s.tile : undefined,
    window:
      typeof s.window === "number"
        ? s.window
        : typeof s.window === "string" && s.window
          ? Number(s.window)
          : undefined,
  }),
  component: function PgpInventoryRoute() {
    const { tab = "own", tile, window } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <PgpInventoryPage
        key={`${tab}-${tile ?? ""}-${window ?? ""}`}
        scope={tab}
        initialTile={tile}
        initialWindow={window}
        onScope={(t) => navigate({ search: { tab: t } })}
      />
    );
  },
});
