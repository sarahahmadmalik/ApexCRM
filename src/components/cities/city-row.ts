import type { CityManualStatus } from "@/lib/types/database";

/** A row of the `city_status` view — one tracked city with its derived state. */
export type CityRow = {
  country: string;
  state: string;
  city: string;
  firm_count: number;
  status: CityManualStatus;
  is_manual_override: boolean;
  note: string | null;
};
