import { createFileRoute } from "@tanstack/react-router";
import McpAgentPage from "@/components/agent/McpAgentPage";

export const Route = createFileRoute("/_app/agent/mcp")({
  component: McpAgentPage,
});
