"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/auth/guards";
import type { LeaveStatus, LeaveType, TimesheetStatus } from "@/lib/types/database";

export type LeaveRequestInput = {
  employee_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
};

export type TimesheetInput = {
  employee_name: string;
  project_name: string;
  work_date: string;
  hours_logged: number;
  billable: boolean;
  notes?: string;
};

export async function createLeaveRequest(input: LeaveRequestInput) {
  await assertAccess("time_leave", "write");
  if (!input.employee_name.trim()) throw new Error("Employee name is required.");
  if (!input.start_date || !input.end_date) throw new Error("Start and end dates are required.");
  if (input.end_date < input.start_date) throw new Error("End date cannot be before start date.");

  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    employee_name: input.employee_name.trim(),
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    days_count: Math.max(1, input.days_count || 1),
    status: "pending",
    reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}

export async function updateLeaveStatus(id: string, status: LeaveStatus, reviewerNote?: string) {
  await assertAccess("time_leave", "write");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status, ...(reviewerNote !== undefined ? { reviewer_note: reviewerNote } : {}) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}

export async function deleteLeaveRequest(id: string) {
  await assertAccess("time_leave", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}

export async function createTimesheet(input: TimesheetInput) {
  await assertAccess("time_leave", "write");
  if (!input.employee_name.trim()) throw new Error("Employee name is required.");
  if (!input.project_name.trim()) throw new Error("Project name is required.");
  if (input.hours_logged <= 0 || input.hours_logged > 24) throw new Error("Hours must be between 0.5 and 24.");

  const supabase = await createClient();
  const { error } = await supabase.from("timesheets").insert({
    employee_name: input.employee_name.trim(),
    project_name: input.project_name.trim(),
    work_date: input.work_date,
    hours_logged: input.hours_logged,
    billable: input.billable,
    status: "submitted",
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}

export async function updateTimesheetStatus(id: string, status: TimesheetStatus) {
  await assertAccess("time_leave", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("timesheets").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}

export async function deleteTimesheet(id: string) {
  await assertAccess("time_leave", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("timesheets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/time-leave");
}
