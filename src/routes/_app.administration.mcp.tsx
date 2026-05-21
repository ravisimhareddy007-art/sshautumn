import { createFileRoute } from "@tanstack/react-router";
import McpToolsPage from "@/components/agent/McpToolsPage";

export const Route = createFileRoute("/_app/administration/mcp")({
  component: McpToolsPage,
});
