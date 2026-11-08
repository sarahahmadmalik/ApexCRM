"use server";

import { createClient } from "@/lib/supabase/server";
import type { CityManualStatus } from "@/lib/types/database";
import { assertAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

export async function setCityOverride(
  country: string,
  state: string,
  city: string,
  manualStatus: CityManualStatus | null,
  note: string
) {
  await assertAccess("cities", "write");

  const supabase = await createClient();
  const { error } = await supabase
    .from("city_completion")
    .upsert(
      { country, state, city, manual_status: manualStatus, note: note || null, updated_at: new Date().toISOString() },
      { onConflict: "country,state,city" }
    );
  if (error) throw new Error(error.message);

  revalidatePath("/cities");
  revalidatePath("/overview");
}

export async function clearCityOverride(country: string, state: string, city: string) {
  return setCityOverride(country, state, city, null, "");
}
