import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export function Placeholder({
  breadcrumbs,
  title,
  subtitle = "This section is under development.",
}: {
  breadcrumbs: string[];
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <PageHeader breadcrumbs={breadcrumbs} title={title} />
      <Card className="p-12 flex flex-col items-center justify-center text-center">
        <Construction className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-[16px] font-semibold">{title}</div>
        <div className="text-[13px] text-muted-foreground mt-1 max-w-md">{subtitle}</div>
      </Card>
    </div>
  );
}
