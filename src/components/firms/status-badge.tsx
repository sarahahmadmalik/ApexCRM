import { Badge } from "@/components/ui/badge";
import { FIRM_STATUS_COLORS, FIRM_STATUS_DOT, FIRM_STATUS_LABELS } from "@/lib/utils";
import type { FirmStatus } from "@/lib/types/database";

export function StatusBadge({ status }: { status: FirmStatus }) {
  return (
    <Badge className={`gap-1.5 ${FIRM_STATUS_COLORS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${FIRM_STATUS_DOT[status]}`} />
      {FIRM_STATUS_LABELS[status]}
    </Badge>
  );
}
