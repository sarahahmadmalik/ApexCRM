import { CITY_CLIENT_HEX, CITY_STATUS_HEX, CITY_STATUS_LABELS } from "@/lib/utils";

/** Only the states that appear on the map — cities with no outreach yet aren't plotted. */
const SHOWN = ["in_progress", "completed"] as const;

export function MapLegend() {
  return (
    <div className="space-y-1.5 pt-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {SHOWN.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CITY_STATUS_HEX[key] }} />
            {CITY_STATUS_LABELS[key]}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CITY_CLIENT_HEX }} />
          Client received
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">Cities with no outreach yet are hidden.</p>
    </div>
  );
}
