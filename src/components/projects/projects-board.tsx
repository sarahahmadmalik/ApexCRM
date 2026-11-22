"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  FolderKanban,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormRow, Input, Textarea } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusMenu } from "@/components/ui/status-menu";
import { TableEmptyState, TableHead, TableShell } from "@/components/ui/table-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useCanWrite } from "@/components/auth/permissions-provider";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  Database,
  ProjectPriority,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/lib/types/database";
import {
  createProject,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  updateProjectStatus,
  updateTaskStatus,
} from "@/app/(app)/projects/actions";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectTask = Database["public"]["Tables"]["project_tasks"]["Row"];

const PROJECT_STATUS_ORDER: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
};
const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300",
  active: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
  on_hold: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
  medium: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300",
  high: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  critical: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "In Review",
  done: "Done",
};
const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
  in_progress: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
  review: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
};

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={PROJECT_STATUS_STYLES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={TASK_STATUS_STYLES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function ProjectsBoard({
  initialProjects,
  initialTasks,
  isDemoFallback = false,
}: {
  initialProjects: Project[];
  initialTasks: ProjectTask[];
  isDemoFallback?: boolean;
}) {
  const canWrite = useCanWrite("projects");
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks);
  const [tab, setTab] = useState<"portfolio" | "kanban" | "tasks">("portfolio");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.client_name?.toLowerCase().includes(q) ?? false) &&
        !p.owner_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [projects, search, statusFilter]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectFilter !== "ALL" && t.project_id !== projectFilter) return false;
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !(t.assignee_name?.toLowerCase().includes(q) ?? false) &&
        !(projectById.get(t.project_id)?.name.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, search, projectFilter, projectById]);

  async function handleProjectStatus(project: Project, status: ProjectStatus) {
    const prev = projects;
    setProjects((cur) =>
      cur.map((p) =>
        p.id === project.id ? { ...p, status, progress: status === "completed" ? 100 : p.progress } : p
      )
    );
    try {
      if (!isDemoFallback) await updateProjectStatus(project.id, status);
      toast.success(`${project.name} marked as ${PROJECT_STATUS_LABELS[status]}`);
    } catch (err) {
      setProjects(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update project");
    }
  }

  async function handleDeleteProject(project: Project) {
    const prev = projects;
    setProjects((cur) => cur.filter((p) => p.id !== project.id));
    try {
      if (!isDemoFallback) await deleteProject(project.id);
      toast.success("Project deleted");
    } catch (err) {
      setProjects(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete project");
    }
  }

  async function handleTaskStatus(task: ProjectTask, status: TaskStatus) {
    const prev = tasks;
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      if (!isDemoFallback) await updateTaskStatus(task.id, status);
      toast.success(`Task moved to ${TASK_STATUS_LABELS[status]}`);
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update task");
    }
  }

  async function handleDeleteTask(task: ProjectTask) {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== task.id));
    try {
      if (!isDemoFallback) await deleteProjectTask(task.id);
      toast.success("Task removed");
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't remove task");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
          {(
            [
              { id: "portfolio", label: `Project Portfolio (${projects.length})` },
              { id: "kanban", label: `Sprint Board (${tasks.length})` },
              { id: "tasks", label: "All Milestones & Tasks" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                tab === item.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" onClick={() => setShowAddTask(true)}>
              <CheckSquare className="h-4 w-4" />
              Add Task
            </Button>
            <Button variant="outline-fill" onClick={() => setShowAddProject(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        )}
      </div>

      <FilterBar
        activeCount={(statusFilter !== "ALL" ? 1 : 0) + (projectFilter !== "ALL" ? 1 : 0)}
        onClearAll={() => {
          setSearch("");
          setStatusFilter("ALL");
          setProjectFilter("ALL");
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: tab === "portfolio" ? "Search projects, clients or owners..." : "Search tasks or assignees...",
        }}
      >
        {tab === "portfolio" ? (
          <Combobox
            options={[
              { value: "ALL", label: "All project statuses" },
              ...PROJECT_STATUS_ORDER.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] })),
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || "ALL")}
            placeholder="All project statuses"
          />
        ) : (
          <Combobox
            options={[
              { value: "ALL", label: "All projects" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={projectFilter}
            onChange={(v) => setProjectFilter(v || "ALL")}
            placeholder="All projects"
          />
        )}
      </FilterBar>

      {/* VIEW 1: PROJECT PORTFOLIO CARDS */}
      {tab === "portfolio" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredProjects.map((project) => {
            const projectTasks = tasks.filter((t) => t.project_id === project.id);
            const completedTasks = projectTasks.filter((t) => t.status === "done").length;
            const burnPct = project.budget > 0 ? Math.min(100, Math.round((project.spent / project.budget) * 100)) : 0;

            return (
              <Card key={project.id} className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("uppercase text-[10px]", PRIORITY_STYLES[project.priority])}>
                          {project.priority} priority
                        </Badge>
                        {project.client_name && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                            <Building2 className="h-3.5 w-3.5" />
                            {project.client_name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display mt-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {project.name}
                      </h3>
                    </div>

                    {canWrite ? (
                      <StatusMenu
                        value={project.status}
                        options={PROJECT_STATUS_ORDER}
                        renderBadge={(s) => <ProjectStatusBadge status={s} />}
                        onChange={(s) => handleProjectStatus(project, s)}
                      />
                    ) : (
                      <ProjectStatusBadge status={project.status} />
                    )}
                  </div>

                  {project.description && (
                    <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-400">{project.description}</p>
                  )}

                  {/* Progress & Budget bars */}
                  <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3.5 sm:grid-cols-2 dark:bg-white/5">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-500 dark:text-gray-400">Delivery progress</span>
                        <span className="font-mono-brand font-bold text-gray-900 dark:text-white">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-300"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-500 dark:text-gray-400">Budget utilization</span>
                        <span className="font-mono-brand font-bold text-gray-900 dark:text-white">
                          {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            burnPct > 90 ? "bg-rose-500" : burnPct > 75 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${burnPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3.5 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      Lead: <strong className="text-gray-800 dark:text-gray-200">{project.owner_name}</strong>
                    </span>
                    {project.due_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Due {formatDate(project.due_date)}
                      </span>
                    )}
                    <span>
                      {completedTasks}/{projectTasks.length} tasks done
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setProjectFilter(project.id);
                        setTab("kanban");
                      }}
                    >
                      View Tasks
                    </Button>
                    {canWrite && (
                      <button
                        type="button"
                        title="Delete project"
                        onClick={() =>
                          confirm({
                            title: "Delete project",
                            message: `Delete "${project.name}" and all of its milestones and tasks?`,
                            confirmLabel: "Delete",
                            onConfirm: () => handleDeleteProject(project),
                          })
                        }
                        className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* VIEW 2: SPRINT KANBAN BOARD */}
      {tab === "kanban" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUS_ORDER.map((status) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-navy-900/60"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <TaskStatusBadge status={status} />
                  <span className="font-mono-brand rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-600 ring-1 ring-gray-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {colTasks.length === 0 ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
                      No tasks in {TASK_STATUS_LABELS[status].toLowerCase()}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const proj = projectById.get(task.project_id);
                      return (
                        <Card key={task.id} className="flex flex-col justify-between gap-3 p-4">
                          <div>
                            <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                              {proj?.name ?? "Project"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{task.title}</p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assignee_name || "Unassigned"}
                              </span>
                              <span className="font-mono-brand inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {task.estimated_hours}h
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-white/10">
                            <span className="text-[11px] text-gray-400">
                              {task.due_date ? `Due ${formatDate(task.due_date)}` : "Flexible"}
                            </span>
                            {canWrite && (
                              <StatusMenu
                                value={task.status}
                                options={TASK_STATUS_ORDER}
                                renderBadge={(s) => <TaskStatusBadge status={s} />}
                                onChange={(s) => handleTaskStatus(task, s)}
                              />
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: ALL TASKS TABLE */}
      {tab === "tasks" && (
        <TableShell>
          <table className="w-full min-w-[860px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Milestone / Task", width: "w-[32%]" },
                { label: "Project", width: "w-[24%]" },
                { label: "Assignee", width: "w-[14%]" },
                { label: "Due & Effort", width: "w-[14%]" },
                { label: "Status", width: "w-[10%]" },
                { label: "", align: "right", width: "w-[6%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredTasks.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  icon={FolderKanban}
                  title="No tasks found"
                  description="Add a new milestone or adjust your project filter."
                />
              ) : (
                filteredTasks.map((task) => {
                  const proj = projectById.get(task.project_id);
                  return (
                    <tr key={task.id} className="h-13 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{task.title}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{proj?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{task.assignee_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {task.due_date ? formatDate(task.due_date) : "—"} · {task.estimated_hours}h
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <StatusMenu
                            value={task.status}
                            options={TASK_STATUS_ORDER}
                            renderBadge={(s) => <TaskStatusBadge status={s} />}
                            onChange={(s) => handleTaskStatus(task, s)}
                          />
                        ) : (
                          <TaskStatusBadge status={task.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && (
                          <button
                            type="button"
                            title="Delete task"
                            onClick={() => handleDeleteTask(task)}
                            className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {confirmDialog}

      <AddProjectDialog
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(p) => setProjects((cur) => [p, ...cur])}
      />

      <AddTaskDialog
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        projects={projects}
        isDemoFallback={isDemoFallback}
        onCreated={(t) => setTasks((cur) => [t, ...cur])}
      />
    </div>
  );
}

function AddProjectDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (project: Project) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [priority, setPriority] = useState<ProjectPriority>("high");

  async function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const client_name = String(formData.get("client_name") ?? "").trim();
    const owner_name = String(formData.get("owner_name") ?? "").trim();
    const budget = Number(formData.get("budget") ?? 0);
    const due_date = String(formData.get("due_date") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name || !owner_name) {
      toast.error("Project name and lead owner are required.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createProject({
          name,
          client_name,
          owner_name,
          status: "active",
          priority,
          budget,
          spent: 0,
          progress: 10,
          start_date: new Date().toISOString().slice(0, 10),
          due_date: due_date || null,
          description,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        name,
        firm_id: null,
        client_name: client_name || null,
        owner_name,
        status: "active",
        priority,
        budget,
        spent: 0,
        progress: 10,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: due_date || null,
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Project created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create new project"
      description="Track client delivery, budget burn, and milestone completion."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-project-form" variant="outline-brand" loading={saving}>
            Create project
          </Button>
        </div>
      }
    >
      <form id="add-project-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Project name" required>
          <Input name="name" placeholder="e.g. Enterprise Customer Portal v2" required />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Client / Account">
            <Input name="client_name" placeholder="e.g. Gamma Logistik GmbH" />
          </FormRow>
          <FormRow label="Delivery lead" required>
            <Input name="owner_name" placeholder="e.g. Sara Malik" required />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Total budget (EUR)">
            <Input name="budget" type="number" min={0} step={500} defaultValue={25000} />
          </FormRow>
          <FormRow label="Priority">
            <Combobox
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
              value={priority}
              onChange={(v) => setPriority((v as ProjectPriority) || "high")}
            />
          </FormRow>
        </div>
        <FormRow label="Target completion date">
          <Input name="due_date" type="date" />
        </FormRow>
        <FormRow label="Scope & deliverables">
          <Textarea name="description" rows={3} placeholder="Key milestones, SLA expectations..." />
        </FormRow>
      </form>
    </Dialog>
  );
}

function AddTaskDialog({
  open,
  onClose,
  projects,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  isDemoFallback: boolean;
  onCreated: (task: ProjectTask) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  async function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const assignee_name = String(formData.get("assignee_name") ?? "").trim();
    const due_date = String(formData.get("due_date") ?? "").trim();
    const estimated_hours = Number(formData.get("estimated_hours") ?? 4);
    const targetProjectId = projectId || projects[0]?.id;

    if (!title || !targetProjectId) {
      toast.error("Pick a project and enter a task title.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createProjectTask({
          project_id: targetProjectId,
          title,
          assignee_name,
          status: "todo",
          priority,
          due_date: due_date || null,
          estimated_hours,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        project_id: targetProjectId,
        title,
        assignee_name: assignee_name || null,
        status: "todo",
        priority,
        due_date: due_date || null,
        estimated_hours,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Task added");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add project task"
      description="Assign a deliverable or sprint task to a team member."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-task-form" variant="outline-brand" loading={saving}>
            Save task
          </Button>
        </div>
      }
    >
      <form id="add-task-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Project" required>
          <Combobox
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={projectId || projects[0]?.id || null}
            onChange={(v) => setProjectId(v ?? "")}
          />
        </FormRow>
        <FormRow label="Task title" required>
          <Input name="title" placeholder="e.g. Implement OAuth 2.1 SSO callback" required />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Assignee">
            <Input name="assignee_name" placeholder="e.g. Lukas Weber" />
          </FormRow>
          <FormRow label="Priority">
            <Combobox
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
              value={priority}
              onChange={(v) => setPriority((v as TaskPriority) || "medium")}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Due date">
            <Input name="due_date" type="date" />
          </FormRow>
          <FormRow label="Estimated effort (hours)">
            <Input name="estimated_hours" type="number" min={1} max={200} defaultValue={8} />
          </FormRow>
        </div>
      </form>
    </Dialog>
  );
}
