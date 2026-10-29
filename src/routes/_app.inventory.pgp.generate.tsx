import { createFileRoute } from "@tanstack/react-router";
import { GeneratePgpKeyPage } from "@/components/pgp/GeneratePgpKeyPage";

export const Route = createFileRoute("/_app/inventory/pgp/generate")({
  component: GeneratePgpKeyPage,
});
