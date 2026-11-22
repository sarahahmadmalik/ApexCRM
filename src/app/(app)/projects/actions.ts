"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/auth/guards";
import type { ProjectPriority, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/types/database";

export type ProjectInput = {
  name: string;
  client_name?: string;
  owner_name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  budget: number;
  spent: number;
  progress: number;
  start_date?: string | null;
  due_date?: string | null;
  description?: string;
};

export type TaskInput = {
  project_id: string;
  title: string;
  assignee_name?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  estimated_hours: number;
};

export async function createProject(input: ProjectInput) {
  await assertAccess("projects", "write");
  if (!input.name.trim()) throw new Error("Project name is required.");
  if (!input.owner_name.trim()) throw new Error("Project owner is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    name: input.name.trim(),
    client_name: input.client_name?.trim() || null,
    owner_name: input.owner_name.trim(),
    status: input.status,
    priority: input.priority,
    budget: Math.max(0, input.budget || 0),
    spent: Math.max(0, input.spent || 0),
    progress: Math.min(100, Math.max(0, input.progress || 0)),
    start_date: input.start_date || null,
    due_date: input.due_date || null,
    description: input.description?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await assertAccess("projects", "write");
  const supabase = await createClient();
  const progressPatch = status === "completed" ? { status, progress: 100 } : { status };
  const { error } = await supabase.from("projects").update(progressPatch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  await assertAccess("projects", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function createProjectTask(input: TaskInput) {
  await assertAccess("projects", "write");
  if (!input.project_id) throw new Error("Pick a project.");
  if (!input.title.trim()) throw new Error("Task title is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").insert({
    project_id: input.project_id,
    title: input.title.trim(),
    assignee_name: input.assignee_name?.trim() || null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date || null,
    estimated_hours: Math.max(0.5, input.estimated_hours || 4),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  await assertAccess("projects", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function deleteProjectTask(id: string) {
  await assertAccess("projects", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}
