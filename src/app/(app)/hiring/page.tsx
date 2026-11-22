import { Briefcase, CalendarCheck2, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { HiringBoard } from "@/components/hiring/hiring-board";
import { DEMO_JOB_CANDIDATES, DEMO_JOB_OPENINGS } from "@/lib/data/showcase-seed";

export const metadata = { title: "Hiring & ATS · ApexCRM" };

export default async function HiringPage() {
  await requirePageAccess("hiring");
  const supabase = await createClient();

  const [openingsRes, candidatesRes] = await Promise.all([
    supabase.from("job_openings").select("*").order("created_at", { ascending: false }),
    supabase.from("job_candidates").select("*").order("created_at", { ascending: false }),
  ]);

  const isDemoFallback = Boolean(openingsRes.error || candidatesRes.error);
  const openings = isDemoFallback ? DEMO_JOB_OPENINGS : (openingsRes.data ?? []);
  const candidates = isDemoFallback ? DEMO_JOB_CANDIDATES : (candidatesRes.data ?? []);

  const openRolesCount = openings.filter((j) => j.status === "open").length;
  const activeCandidatesCount = candidates.filter((c) => c.stage !== "rejected" && c.stage !== "hired").length;
  const interviewsCount = candidates.filter((c) => c.stage === "interview").length;
  const offersAndHiredCount = candidates.filter((c) => c.stage === "offer" || c.stage === "hired").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hiring & Talent Acquisition (ATS)"
        description="Manage open job requisitions, evaluate candidates across interview stages, and convert offers into onboarded employees."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open requisitions"
          value={openRolesCount}
          sublabel={`${openings.length} total tracked roles`}
          icon={<Briefcase className="h-5 w-5" />}
          tone="slate"
        />
        <StatCard
          label="Active candidates"
          value={activeCandidatesCount}
          sublabel="In screening, interview or offer"
          icon={<Users className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label="Interviews scheduled"
          value={interviewsCount}
          sublabel="Technical & panel rounds"
          icon={<CalendarCheck2 className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Offers & hires"
          value={offersAndHiredCount}
          sublabel="Extended or accepted offers"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <HiringBoard
        initialOpenings={openings}
        initialCandidates={candidates}
        isDemoFallback={isDemoFallback}
      />
    </div>
  );
}
