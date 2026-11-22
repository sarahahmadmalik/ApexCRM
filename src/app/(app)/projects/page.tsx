import { Banknote, CheckCircle2, FolderKanban, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { ProjectsBoard } from "@/components/projects/projects-board";
import { DEMO_PROJECTS, DEMO_PROJECT_TASKS } from "@/lib/data/showcase-seed";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Projects & Tasks · ApexCRM" };

export default async function ProjectsPage() {
  await requirePageAccess("projects");
  const supabase = await createClient();

  const [projectsRes, tasksRes] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("project_tasks").select("*").order("created_at", { ascending: false }),
  ]);

  const isDemoFallback = Boolean(projectsRes.error || tasksRes.error);
  const projects = isDemoFallback ? DEMO_PROJECTS : (projectsRes.data ?? []);
  const tasks = isDemoFallback ? DEMO_PROJECT_TASKS : (tasksRes.data ?? []);

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "planning").length;
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget ?? 0), 0);
  const avgProgress =
    projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0;
  const openTasks = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Delivery Management"
        description="Track active client engagements, milestone completion, sprint task boards, and project budget utilization."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active engagements"
          value={activeProjects}
          sublabel={`${projects.length} total projects in portfolio`}
          icon={<FolderKanban className="h-5 w-5" />}
          tone="slate"
        />
        <StatCard
          label="Portfolio value"
          value={formatCurrency(totalBudget)}
          trend={{ direction: "up", label: "+18.5% vs Q3" }}
          sparkline={[72000, 84000, 91000, 105000, 118000, Math.max(134000, totalBudget)]}
          icon={<Banknote className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Avg. completion"
          value={`${avgProgress}%`}
          sublabel="Across all tracked milestones"
          sparkline={[28, 35, 41, 48, 52, Math.max(57, avgProgress)]}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Open sprint tasks"
          value={openTasks}
          sublabel={`${tasks.length - openTasks} tasks completed`}
          icon={<ListChecks className="h-5 w-5" />}
          tone="indigo"
        />
      </div>

      <ProjectsBoard initialProjects={projects} initialTasks={tasks} isDemoFallback={isDemoFallback} />
    </div>
  );
}
