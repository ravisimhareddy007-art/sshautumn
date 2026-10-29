import { createFileRoute } from "@tanstack/react-router";
import { PgpInventoryPage } from "@/components/pgp/PgpInventoryPage";

type Search = { tile?: string; window?: number };

export const Route = createFileRoute("/_app/inventory/pgp/trusted")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tile: typeof s.tile === "string" ? s.tile : undefined,
    window:
      typeof s.window === "number"
        ? s.window
        : typeof s.window === "string" && s.window
          ? Number(s.window)
          : undefined,
  }),
  component: function PgpRoute() {
    const { tile, window } = Route.useSearch();
    return (
      <PgpInventoryPage
        key={`${tile ?? ""}-${window ?? ""}`}
        scope="trusted"
        initialTile={tile}
        initialWindow={window}
      />
    );
  },
});
