import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, History, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/firms/status-badge";
import { FIRM_STATUS_COLORS } from "@/lib/utils";
import type { FirmStatus } from "@/lib/types/database";
import { COUNTRY_FLAG } from "@/lib/data/geo";

/** Avatar tints come from the status-pill palette only — no colours outside it. */
const AVATAR_TINTS = Object.values(FIRM_STATUS_COLORS);

function avatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export type ActivityRow = {
  id: string;
  firm_name: string;
  city: string;
  country: string;
  old_status: FirmStatus | null;
  new_status: FirmStatus;
  changed_by_name: string | null;
  changed_at: string;
};

export function ActivityFeed({ rows, unavailable }: { rows: ActivityRow[]; unavailable?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider dark:bg-white/5 dark:text-gray-400">
            <th className="py-2.5 px-3 rounded-l-lg font-semibold">Company & Location</th>
            <th className="py-2.5 px-3 font-semibold">Status</th>
            <th className="py-2.5 px-3 rounded-r-lg font-semibold text-right">Timestamp</th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-900 divide-y divide-gray-100 dark:divide-white/10 dark:text-gray-100">
          {unavailable || rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  <History className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  {unavailable 
                    ? "Activity log requires database initialization." 
                    : "No recent activity recorded."}
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/60 transition-colors group dark:hover:bg-white/5">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${avatarTint(row.firm_name)}`}
                    >
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{row.firm_name}</span>
                      <span className="text-gray-400 text-xs dark:text-gray-500">
                        {row.city}, {COUNTRY_FLAG[row.country] || row.country}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    {row.old_status && (
                      <>
                        <StatusBadge status={row.old_status} />
                        <ArrowRight className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                      </>
                    )}
                    <StatusBadge status={row.new_status} />
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono text-xs text-gray-500 dark:text-gray-400">
                  {formatDistanceToNowStrict(new Date(row.changed_at), { addSuffix: true })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
