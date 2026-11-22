"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/auth/guards";
import type { CandidateStage, EmploymentType, JobOpeningStatus } from "@/lib/types/database";

export type JobOpeningInput = {
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  salary_range?: string;
  status: JobOpeningStatus;
  description?: string;
};

export type CandidateInput = {
  job_id: string;
  full_name: string;
  email: string;
  phone?: string;
  stage: CandidateStage;
  rating: number;
  interview_date?: string | null;
  portfolio_url?: string;
  notes?: string;
};

export async function createJobOpening(input: JobOpeningInput) {
  await assertAccess("hiring", "write");
  if (!input.title.trim()) throw new Error("Job title is required.");
  if (!input.department.trim()) throw new Error("Department is required.");
  if (!input.location.trim()) throw new Error("Location is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").insert({
    title: input.title.trim(),
    department: input.department.trim(),
    location: input.location.trim(),
    employment_type: input.employment_type,
    salary_range: input.salary_range?.trim() || null,
    status: input.status,
    description: input.description?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

export async function updateJobOpeningStatus(id: string, status: JobOpeningStatus) {
  await assertAccess("hiring", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

export async function deleteJobOpening(id: string) {
  await assertAccess("hiring", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

export async function createCandidate(input: CandidateInput) {
  await assertAccess("hiring", "write");
  if (!input.job_id) throw new Error("Select a job opening.");
  if (!input.full_name.trim()) throw new Error("Candidate name is required.");
  if (!input.email.trim()) throw new Error("Candidate email is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("job_candidates").insert({
    job_id: input.job_id,
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    stage: input.stage,
    rating: Math.min(5, Math.max(1, input.rating || 4)),
    interview_date: input.interview_date || null,
    portfolio_url: input.portfolio_url?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

export async function updateCandidateStage(id: string, stage: CandidateStage) {
  await assertAccess("hiring", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("job_candidates").update({ stage }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

export async function deleteCandidate(id: string) {
  await assertAccess("hiring", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("job_candidates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hiring");
}

/** Promotes a candidate to the Employees roster and marks their ATS stage as 'hired'. */
export async function promoteCandidateToEmployee(input: {
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  position: string;
  employment_type?: EmploymentType;
}) {
  await assertAccess("hiring", "write");
  const supabase = await createClient();

  const { error: empError } = await supabase.from("employees").insert({
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    position: input.position.trim() || "Team Member",
    country: "Germany",
    employment_type: input.employment_type ?? "full_time",
    contract_start_date: new Date().toISOString().slice(0, 10),
  });
  if (empError) throw new Error(empError.message);

  const { error: stageError } = await supabase
    .from("job_candidates")
    .update({ stage: "hired" })
    .eq("id", input.candidate_id);
  if (stageError) throw new Error(stageError.message);

  revalidatePath("/hiring");
  revalidatePath("/employees");
}
