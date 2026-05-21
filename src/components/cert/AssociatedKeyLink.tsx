import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { USER_KEYS, HOST_KEYS, type SshKey } from "@/data/mock";
import { cn } from "@/lib/utils";

export function AssociatedKeyLink({
  scope,
  keyId,
  keyName,
}: {
  scope: "user" | "host";
  keyId: string;
  keyName: string;
}) {
  const pool: SshKey[] = scope === "user" ? USER_KEYS : HOST_KEYS;
  const k = pool.find((x) => x.id === keyId);
  const targetRoute = scope === "user" ? "/inventory/keys/user" : "/inventory/keys/host";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-primary underline underline-offset-2 hover:text-primary-hover truncate-inner text-left"
          title={keyName}
        >
          {keyName}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 12,
          minWidth: 220,
        }}
      >
        {k ? (
          <div className="text-[13px] text-foreground space-y-2">
            <div className="font-semibold text-[14px] truncate" title={k.name}>
              {k.name}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              <span className="text-muted-foreground">Encryption</span>
              <span>{k.encryption}</span>
              <span className="text-muted-foreground">Key Length</span>
              <span>{k.length}</span>
              <span className="text-muted-foreground">Age</span>
              <span>{k.age}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge
                variant="outline"
                className={cn(
                  k.status === "Active" && "bg-risk-green/15 text-risk-green border-risk-green/30",
                  k.status === "Inactive" && "bg-muted text-muted-foreground border-border",
                  k.status === "Revoked" && "bg-risk-red/15 text-risk-red border-risk-red/30",
                )}
              >
                {k.status}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  k.riskStatus === "None"
                    ? "bg-risk-green/15 text-risk-green border-risk-green/30"
                    : "bg-risk-red/15 text-risk-red border-risk-red/30",
                )}
              >
                {k.riskStatus === "None" ? "No Risk" : k.riskStatus}
              </Badge>
            </div>
            <Link
              to={targetRoute}
              search={{ highlight: k.id }}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover"
            >
              View in Key Inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">
            Key details unavailable.
            <div className="mt-2">
              <Link
                to={targetRoute}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover"
              >
                View in Key Inventory <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
