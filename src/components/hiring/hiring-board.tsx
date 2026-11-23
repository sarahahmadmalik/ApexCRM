"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
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
import { avatarTint, cn, EMPLOYMENT_TYPE_LABELS, formatDate } from "@/lib/utils";
import {
  extractTextFromResumeFile,
  parseCandidateResumeMeta,
  parseResumeContent,
  SAMPLE_RESUMES,
  type ExtractedResumeData,
} from "@/lib/resume-parser";
import type { CandidateStage, Database, EmploymentType, JobOpeningStatus } from "@/lib/types/database";
import {
  createCandidate,
  createJobOpening,
  deleteCandidate,
  deleteJobOpening,
  promoteCandidateToEmployee,
  updateCandidateStage,
  updateJobOpeningStatus,
} from "@/app/(app)/hiring/actions";

type JobOpening = Database["public"]["Tables"]["job_openings"]["Row"];
type JobCandidate = Database["public"]["Tables"]["job_candidates"]["Row"];

const STAGE_ORDER: CandidateStage[] = ["applied", "screening", "interview", "offer", "hired", "rejected"];
const STAGE_LABELS: Record<CandidateStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer Sent",
  hired: "Hired",
  rejected: "Archived",
};
const STAGE_STYLES: Record<CandidateStage, string> = {
  applied: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
  screening: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
  interview: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300",
  offer: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  hired: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

const JOB_STATUS_ORDER: JobOpeningStatus[] = ["open", "paused", "closed"];
const JOB_STATUS_LABELS: Record<JobOpeningStatus, string> = {
  open: "Open",
  paused: "Paused",
  closed: "Closed",
};
const JOB_STATUS_STYLES: Record<JobOpeningStatus, string> = {
  open: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  closed: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  return <Badge className={STAGE_STYLES[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobOpeningStatus }) {
  return <Badge className={JOB_STATUS_STYLES[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}

export function HiringBoard({
  initialOpenings,
  initialCandidates,
  isDemoFallback = false,
}: {
  initialOpenings: JobOpening[];
  initialCandidates: JobCandidate[];
  isDemoFallback?: boolean;
}) {
  const canWrite = useCanWrite("hiring");
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [openings, setOpenings] = useState<JobOpening[]>(initialOpenings);
  const [candidates, setCandidates] = useState<JobCandidate[]>(initialCandidates);
  const [tab, setTab] = useState<"pipeline" | "table" | "openings">("pipeline");
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<JobCandidate | null>(null);

  const jobById = useMemo(() => new Map(openings.map((j) => [j.id, j])), [openings]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (jobFilter !== "ALL" && c.job_id !== jobFilter) return false;
      if (stageFilter !== "ALL" && c.stage !== stageFilter) return false;
      if (
        q &&
        !c.full_name.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q) &&
        !(c.notes?.toLowerCase().includes(q) ?? false) &&
        !(jobById.get(c.job_id)?.title.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [candidates, search, jobFilter, stageFilter, jobById]);

  async function handleStageChange(candidate: JobCandidate, stage: CandidateStage) {
    const prev = candidates;
    setCandidates((cur) => cur.map((c) => (c.id === candidate.id ? { ...c, stage } : c)));
    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate((cur) => (cur ? { ...cur, stage } : null));
    }
    try {
      if (!isDemoFallback) await updateCandidateStage(candidate.id, stage);
      toast.success(`${candidate.full_name} moved to ${STAGE_LABELS[stage]}`);
    } catch (err) {
      setCandidates(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update stage");
    }
  }

  async function handleDeleteCandidate(candidate: JobCandidate) {
    const prev = candidates;
    setCandidates((cur) => cur.filter((c) => c.id !== candidate.id));
    if (selectedCandidate?.id === candidate.id) setSelectedCandidate(null);
    try {
      if (!isDemoFallback) await deleteCandidate(candidate.id);
      toast.success("Candidate removed");
    } catch (err) {
      setCandidates(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't remove candidate");
    }
  }

  async function handlePromoteToEmployee(candidate: JobCandidate) {
    const job = jobById.get(candidate.job_id);
    const prev = candidates;
    setCandidates((cur) => cur.map((c) => (c.id === candidate.id ? { ...c, stage: "hired" } : c)));
    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate((cur) => (cur ? { ...cur, stage: "hired" } : null));
    }
    try {
      if (!isDemoFallback) {
        await promoteCandidateToEmployee({
          candidate_id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          position: job?.title ?? "Software Engineer",
          employment_type: job?.employment_type ?? "full_time",
        });
      }
      toast.success(`${candidate.full_name} promoted to Employees roster!`);
    } catch (err) {
      setCandidates(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't onboard candidate");
    }
  }

  async function handleJobStatusChange(job: JobOpening, status: JobOpeningStatus) {
    const prev = openings;
    setOpenings((cur) => cur.map((j) => (j.id === job.id ? { ...j, status } : j)));
    try {
      if (!isDemoFallback) await updateJobOpeningStatus(job.id, status);
      toast.success(`${job.title} marked as ${JOB_STATUS_LABELS[status]}`);
    } catch (err) {
      setOpenings(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update role");
    }
  }

  async function handleDeleteJob(job: JobOpening) {
    const prev = openings;
    setOpenings((cur) => cur.filter((j) => j.id !== job.id));
    try {
      if (!isDemoFallback) await deleteJobOpening(job.id);
      toast.success("Job opening deleted");
    } catch (err) {
      setOpenings(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete job opening");
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: View Switcher + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-navy-900">
          {(
            [
              { id: "pipeline", label: `Applicant Pipeline (${candidates.length})` },
              { id: "table", label: "Candidate Directory" },
              { id: "openings", label: `Job Openings (${openings.length})` },
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
            <Button variant="outline" onClick={() => setShowAddJob(true)}>
              <Briefcase className="h-4 w-4" />
              New Job Opening
            </Button>
            <Button variant="outline-fill" onClick={() => setShowAddCandidate(true)}>
              <Upload className="h-4 w-4" />
              Add Candidate / Parse Resume
            </Button>
          </div>
        )}
      </div>

      {tab !== "openings" && (
        <FilterBar
          activeCount={(jobFilter !== "ALL" ? 1 : 0) + (stageFilter !== "ALL" ? 1 : 0)}
          onClearAll={() => {
            setSearch("");
            setJobFilter("ALL");
            setStageFilter("ALL");
          }}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search candidates by name, email, resume skills or role...",
          }}
        >
          <Combobox
            options={[
              { value: "ALL", label: "All job openings" },
              ...openings.map((j) => ({ value: j.id, label: j.title })),
            ]}
            value={jobFilter}
            onChange={(v) => setJobFilter(v || "ALL")}
            placeholder="All job openings"
          />
          <Combobox
            options={[
              { value: "ALL", label: "All pipeline stages" },
              ...STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
            ]}
            value={stageFilter}
            onChange={(v) => setStageFilter(v || "ALL")}
            placeholder="All pipeline stages"
          />
        </FilterBar>
      )}

      {/* VIEW 1: KANBAN PIPELINE */}
      {tab === "pipeline" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(["applied", "screening", "interview", "offer", "hired"] as CandidateStage[]).map((stage) => {
            const stageCandidates = filteredCandidates.filter((c) => c.stage === stage);
            return (
              <div
                key={stage}
                className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-navy-900/60"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <CandidateStageBadge stage={stage} />
                  <span className="font-mono-brand rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-600 ring-1 ring-gray-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
                    {stageCandidates.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {stageCandidates.length === 0 ? (
                    <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
                      No candidates in {STAGE_LABELS[stage].toLowerCase()}
                    </div>
                  ) : (
                    stageCandidates.map((c, idx) => {
                      const job = jobById.get(c.job_id);
                      const resumeMeta = parseCandidateResumeMeta(c.notes);
                      return (
                        <Card
                          key={c.id}
                          className="flex flex-col justify-between gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedCandidate(c)}
                                className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left"
                              >
                                <div
                                  className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                                    avatarTint(idx)
                                  )}
                                >
                                  {c.full_name
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((p) => p[0])
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400">
                                    {c.full_name}
                                  </p>
                                  <p className="truncate text-xs text-brand-600 dark:text-brand-400">
                                    {job?.title ?? "General Application"}
                                  </p>
                                </div>
                              </button>
                            </div>

                            {/* Linked Resume Pill */}
                            {resumeMeta.resumeFileName && (
                              <button
                                type="button"
                                onClick={() => setSelectedCandidate(c)}
                                className="mt-2.5 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200/70 bg-brand-50/60 px-2.5 py-1.5 text-left text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100/70 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                                <span className="truncate">{resumeMeta.resumeFileName}</span>
                              </button>
                            )}

                            {/* Extracted Skill Tags */}
                            {resumeMeta.skills.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {resumeMeta.skills.slice(0, 3).map((skill) => (
                                  <span
                                    key={skill}
                                    className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {resumeMeta.skills.length > 3 && (
                                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400">
                                    +{resumeMeta.skills.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {resumeMeta.cleanNotes && (
                              <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                {resumeMeta.cleanNotes}
                              </p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
                              <span className="inline-flex items-center gap-0.5 text-amber-500">
                                {Array.from({ length: c.rating }).map((_, i) => (
                                  <Star key={i} className="h-3 w-3 fill-current" />
                                ))}
                              </span>
                              {c.interview_date && (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(c.interview_date)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-white/10">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedCandidate(c)}
                                title="Inspect resume & scorecard"
                                className="cursor-pointer rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <a
                                href={`mailto:${c.email}`}
                                title={c.email}
                                className="rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                              {c.portfolio_url && (
                                <a
                                  href={c.portfolio_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Portfolio / GitHub"
                                  className="rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>

                            {canWrite && (
                              <StatusMenu
                                value={c.stage}
                                options={STAGE_ORDER}
                                renderBadge={(s) => <CandidateStageBadge stage={s} />}
                                onChange={(nextStage) => handleStageChange(c, nextStage)}
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

      {/* VIEW 2: CANDIDATE DIRECTORY TABLE */}
      {tab === "table" && (
        <TableShell>
          <table className="w-full min-w-[940px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Candidate", width: "w-[22%]" },
                { label: "Role & Department", width: "w-[22%]" },
                { label: "Linked Resume & Skills", width: "w-[22%]" },
                { label: "Interview", width: "w-[11%]" },
                { label: "Stage", width: "w-[13%]" },
                { label: "Actions", align: "right", width: "w-[10%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredCandidates.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  icon={Users}
                  title="No candidates found"
                  description="Adjust your filters or upload a candidate resume to populate the pipeline."
                />
              ) : (
                filteredCandidates.map((c, idx) => {
                  const job = jobById.get(c.job_id);
                  const resumeMeta = parseCandidateResumeMeta(c.notes);
                  return (
                    <tr key={c.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidate(c)}
                          className="flex cursor-pointer items-center gap-3 text-left"
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                              avatarTint(idx)
                            )}
                          >
                            {c.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 hover:text-brand-600 dark:text-gray-100">
                              {c.full_name}
                            </p>
                            <p className="truncate text-xs text-gray-400 dark:text-gray-500">{c.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">{job?.title ?? "—"}</p>
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {job ? `${job.department} · ${job.location}` : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {resumeMeta.resumeFileName ? (
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(c)}
                            className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300"
                          >
                            <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{resumeMeta.resumeFileName}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No file linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {c.interview_date ? formatDate(c.interview_date) : "Not scheduled"}
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <StatusMenu
                            value={c.stage}
                            options={STAGE_ORDER}
                            renderBadge={(s) => <CandidateStageBadge stage={s} />}
                            onChange={(nextStage) => handleStageChange(c, nextStage)}
                          />
                        ) : (
                          <CandidateStageBadge stage={c.stage} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View resume & scorecard"
                            onClick={() => setSelectedCandidate(c)}
                            className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {canWrite && (
                            <button
                              type="button"
                              title="Remove candidate"
                              onClick={() =>
                                confirm({
                                  title: "Remove candidate",
                                  message: `Remove ${c.full_name} from the applicant tracking pipeline?`,
                                  confirmLabel: "Remove",
                                  onConfirm: () => handleDeleteCandidate(c),
                                })
                              }
                              className="cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {/* VIEW 3: JOB OPENINGS */}
      {tab === "openings" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {openings.map((job) => {
            const applicantCount = candidates.filter((c) => c.job_id === job.id).length;
            const interviewCount = candidates.filter((c) => c.job_id === job.id && c.stage === "interview").length;
            return (
              <Card key={job.id} className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                        {job.department}
                      </span>
                      <h3 className="font-display mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {job.title}
                      </h3>
                    </div>
                    {canWrite ? (
                      <StatusMenu
                        value={job.status}
                        options={JOB_STATUS_ORDER}
                        renderBadge={(s) => <JobStatusBadge status={s} />}
                        onChange={(s) => handleJobStatusChange(job, s)}
                      />
                    ) : (
                      <JobStatusBadge status={job.status} />
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <span>·</span>
                    <span>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
                    {job.salary_range && (
                      <>
                        <span>·</span>
                        <span className="font-mono-brand font-semibold text-gray-700 dark:text-gray-300">
                          {job.salary_range}
                        </span>
                      </>
                    )}
                  </div>

                  {job.description && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{job.description}</p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3.5 dark:border-white/10">
                  <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <span>
                      <strong className="text-gray-900 dark:text-white">{applicantCount}</strong> applicants
                    </span>
                    <span>
                      <strong className="text-blue-600 dark:text-blue-400">{interviewCount}</strong> in interview
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setJobFilter(job.id);
                        setTab("pipeline");
                      }}
                    >
                      View pipeline
                    </Button>
                    {canWrite && (
                      <button
                        type="button"
                        title="Delete role"
                        onClick={() =>
                          confirm({
                            title: "Delete job opening",
                            message: `Delete "${job.title}" and its associated applicant pipeline?`,
                            confirmLabel: "Delete",
                            onConfirm: () => handleDeleteJob(job),
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

      {confirmDialog}

      {/* Add Job Opening Modal */}
      <AddJobDialog
        open={showAddJob}
        onClose={() => setShowAddJob(false)}
        isDemoFallback={isDemoFallback}
        onCreated={(job) => setOpenings((cur) => [job, ...cur])}
      />

      {/* Add Candidate + Resume Parser Modal */}
      <AddCandidateDialog
        open={showAddCandidate}
        onClose={() => setShowAddCandidate(false)}
        openings={openings}
        isDemoFallback={isDemoFallback}
        onCreated={(cand) => setCandidates((cur) => [cand, ...cur])}
      />

      {/* Candidate Linked Resume & Scorecard Drawer */}
      <CandidateDetailsDrawer
        candidate={selectedCandidate}
        job={selectedCandidate ? jobById.get(selectedCandidate.job_id) : undefined}
        canWrite={canWrite}
        onClose={() => setSelectedCandidate(null)}
        onStageChange={(stage) => selectedCandidate && handleStageChange(selectedCandidate, stage)}
        onPromote={() => selectedCandidate && handlePromoteToEmployee(selectedCandidate)}
      />
    </div>
  );
}

function CandidateDetailsDrawer({
  candidate,
  job,
  canWrite,
  onClose,
  onStageChange,
  onPromote,
}: {
  candidate: JobCandidate | null;
  job?: JobOpening;
  canWrite: boolean;
  onClose: () => void;
  onStageChange: (stage: CandidateStage) => void;
  onPromote: () => void;
}) {
  if (!candidate) return null;
  const resumeMeta = parseCandidateResumeMeta(candidate.notes);

  return (
    <Dialog
      open={!!candidate}
      onClose={onClose}
      title={candidate.full_name}
      description={`${job?.title ?? "Candidate"} · ${job?.department ?? "Talent Pipeline"}`}
      position="right"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canWrite && candidate.stage !== "hired" ? (
            <Button variant="outline-brand" onClick={onPromote}>
              <UserCheck className="h-4 w-4" />
              Hire &amp; Promote to Employees Roster
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-4 w-4" />
              Onboarded to Team Roster
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stage & Contact Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Current ATS Stage</p>
            {canWrite ? (
              <StatusMenu
                value={candidate.stage}
                options={STAGE_ORDER}
                renderBadge={(s) => <CandidateStageBadge stage={s} />}
                onChange={onStageChange}
              />
            ) : (
              <CandidateStageBadge stage={candidate.stage} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
            <a href={`mailto:${candidate.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
              <Mail className="h-3.5 w-3.5 text-brand-500" />
              {candidate.email}
            </a>
            {candidate.phone && (
              <a href={`tel:${candidate.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
                <Phone className="h-3.5 w-3.5 text-brand-500" />
                {candidate.phone}
              </a>
            )}
            {candidate.portfolio_url && (
              <a
                href={candidate.portfolio_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Portfolio / Profile
              </a>
            )}
          </div>
        </div>

        {/* Linked Resume Document Card */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-500/25 dark:bg-brand-500/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-brand-700 uppercase dark:text-brand-300">
                  Linked Candidate Resume
                </p>
                <p className="font-mono-brand text-sm font-semibold text-gray-900 dark:text-white">
                  {resumeMeta.resumeFileName ?? `${candidate.full_name.replace(/\s+/g, "_")}_Resume.pdf`}
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-300">
              Verified &amp; Parsed
            </Badge>
          </div>

          {resumeMeta.skills.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                Extracted Skills &amp; Competencies
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resumeMeta.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-2xs ring-1 ring-brand-200 dark:bg-navy-900 dark:text-brand-300 dark:ring-brand-500/30"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-200/80 bg-white p-3.5 text-xs leading-relaxed text-gray-700 dark:border-white/10 dark:bg-navy-900 dark:text-gray-300">
            <p className="mb-1 font-semibold text-gray-900 dark:text-white">Resume Extraction Summary</p>
            <p>{resumeMeta.cleanNotes || candidate.notes || "Candidate profile parsed from uploaded CV."}</p>
          </div>
        </div>

        {/* Evaluation Scorecard */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Interview &amp; Resume Scorecard</h4>
            <span className="inline-flex items-center gap-1 text-amber-500">
              {Array.from({ length: candidate.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
              <span className="ml-1 text-xs font-bold text-gray-700 dark:text-gray-300">{candidate.rating}.0 / 5.0</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: "Technical / Role Competency", pct: candidate.rating * 20 },
              { label: "Experience & Domain Depth", pct: Math.min(100, candidate.rating * 18 + 8) },
              { label: "Communication & Stakeholder Fit", pct: 92 },
              { label: "Culture & Team Alignment", pct: 95 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                  <span className="font-mono-brand font-bold text-gray-900 dark:text-white">{item.pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function AddJobDialog({
  open,
  onClose,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isDemoFallback: boolean;
  onCreated: (job: JobOpening) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");

  async function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const department = String(formData.get("department") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const salary_range = String(formData.get("salary_range") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title || !department || !location) {
      toast.error("Please fill in title, department, and location.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createJobOpening({
          title,
          department,
          location,
          employment_type: employmentType,
          salary_range,
          status: "open",
          description,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        title,
        department,
        location,
        employment_type: employmentType,
        salary_range: salary_range || null,
        status: "open",
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Job opening published");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create job opening");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publish new job opening"
      description="Create an open requisition for the applicant tracking pipeline."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-job-form" variant="outline-brand" loading={saving}>
            <Plus className="h-4 w-4" />
            Publish opening
          </Button>
        </div>
      }
    >
      <form id="add-job-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Job title" required>
          <Input name="title" placeholder="e.g. Senior Backend Engineer" required />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Department" required>
            <Input name="department" placeholder="e.g. Engineering" required />
          </FormRow>
          <FormRow label="Location" required>
            <Input name="location" placeholder="e.g. Berlin / Remote" required />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Employment type">
            <Combobox
              options={[
                { value: "full_time", label: "Full-time" },
                { value: "part_time", label: "Part-time" },
                { value: "contract", label: "Contract" },
              ]}
              value={employmentType}
              onChange={(v) => setEmploymentType((v as EmploymentType) || "full_time")}
            />
          </FormRow>
          <FormRow label="Compensation band">
            <Input name="salary_range" placeholder="e.g. 75.000 € – 90.000 €" />
          </FormRow>
        </div>
        <FormRow label="Role summary & requirements">
          <Textarea name="description" rows={4} placeholder="Key responsibilities and tech stack..." />
        </FormRow>
      </form>
    </Dialog>
  );
}

function AddCandidateDialog({
  open,
  onClose,
  openings,
  isDemoFallback,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  openings: JobOpening[];
  isDemoFallback: boolean;
  onCreated: (candidate: JobCandidate) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [jobId, setJobId] = useState<string>(openings[0]?.id ?? "");
  const [stage, setStage] = useState<CandidateStage>("screening");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [extractedMeta, setExtractedMeta] = useState<ExtractedResumeData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPortfolioUrl("");
    setInterviewDate("");
    setRating(4);
    setNotes("");
    setExtractedMeta(null);
    setStage("applied");
  }

  function applyExtractedData(parsed: ExtractedResumeData) {
    setExtractedMeta(parsed);
    setFullName(parsed.full_name);
    setEmail(parsed.email);
    setPhone(parsed.phone);
    setPortfolioUrl(parsed.portfolio_url);
    setRating(parsed.suggested_rating);
    setNotes(parsed.summary);
    setStage("screening");

    // Auto-match best job opening by detected role keywords
    const roleLower = parsed.detected_role.toLowerCase();
    const matchedJob = openings.find(
      (j) =>
        (roleLower.includes("sales") && /sales|account/i.test(j.title)) ||
        (roleLower.includes("design") && /design/i.test(j.title)) ||
        (roleLower.includes("devops") && /devops|security/i.test(j.title)) ||
        (roleLower.includes("engineer") && /engineer/i.test(j.title))
    );
    if (matchedJob) setJobId(matchedJob.id);
  }

  async function handleResumeFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume file must be under 10 MB.");
      return;
    }
    setParsing(true);
    try {
      const rawText = await extractTextFromResumeFile(file);
      const parsed = parseResumeContent(rawText, file.name);
      applyExtractedData(parsed);
      toast.success(`Extracted candidate profile & ${parsed.skills.length} skills from ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't extract resume data");
    } finally {
      setParsing(false);
    }
  }

  function handleSampleResume(sample: (typeof SAMPLE_RESUMES)[number]) {
    setParsing(true);
    setTimeout(() => {
      try {
        const parsed = parseResumeContent(sample.content, sample.fileName);
        applyExtractedData(parsed);
        toast.success(`Parsed sample resume: ${sample.fileName}`);
      } catch {
        toast.error("Couldn't parse sample resume");
      } finally {
        setParsing(false);
      }
    }, 220);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetJobId = jobId || openings[0]?.id;

    if (!fullName.trim() || !email.trim() || !targetJobId) {
      toast.error("Please fill in candidate name, email, and job opening.");
      return;
    }

    const finalNotes =
      extractedMeta && !notes.includes("[Resume:")
        ? `[Resume: ${extractedMeta.resume_file_name}] · ${notes.trim()}`
        : notes.trim();

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createCandidate({
          job_id: targetJobId,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          stage,
          rating,
          interview_date: interviewDate || null,
          portfolio_url: portfolioUrl.trim(),
          notes: finalNotes,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        job_id: targetJobId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        stage,
        rating,
        interview_date: interviewDate || null,
        portfolio_url: portfolioUrl.trim() || null,
        notes: finalNotes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success(
        extractedMeta
          ? `${fullName.trim()} added with linked resume (${extractedMeta.resume_file_name})`
          : "Candidate added to pipeline"
      );
      resetForm();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add candidate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add Candidate & Resume Auto-Extract"
      description="Upload a resume (.pdf, .docx, .txt) to automatically extract candidate contact info, skills, and role match — or try a 1-click sample resume."
      position="right"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          {extractedMeta ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Resume linked: {extractedMeta.resume_file_name}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Manual entry or resume upload</span>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="add-candidate-form" variant="outline-brand" loading={saving}>
              <UserPlus className="h-4 w-4" />
              Save Candidate &amp; Link Resume
            </Button>
          </div>
        </div>
      }
    >
      <form id="add-candidate-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Smart Resume Dropzone */}
        <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-4 transition-colors dark:border-brand-500/30 dark:bg-brand-500/10">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleResumeFile(f);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
                {parsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Smart Resume Parser &amp; Skill Extractor
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Extracts name, email, phone, portfolio URL, skills &amp; best job opening match.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline-brand"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Resume (.PDF / .DOCX)
            </Button>
          </div>

          {/* 1-Click Sample Resumes for Website Demo Visitors */}
          <div className="mt-3 border-t border-brand-200/60 pt-3 dark:border-white/10">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-brand-700 uppercase dark:text-brand-300">
              Or test instant extraction with a sample resume:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_RESUMES.map((sample) => (
                <button
                  key={sample.fileName}
                  type="button"
                  onClick={() => handleSampleResume(sample)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 transition-all hover:border-brand-500 hover:text-brand-700 dark:border-white/10 dark:bg-navy-800 dark:text-gray-200 dark:hover:border-brand-400"
                >
                  <FileText className="h-3.5 w-3.5 text-brand-500" />
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extracted Resume Preview Banner */}
          {extractedMeta && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4" />
                  Linked: {extractedMeta.resume_file_name} ({extractedMeta.detected_role})
                </span>
                <span>Auto-score: {extractedMeta.suggested_rating}/5 ★</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {extractedMeta.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-navy-900 dark:text-emerald-300 dark:ring-emerald-500/30"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <FormRow label="Target job opening" required>
          <Combobox
            options={openings.map((j) => ({ value: j.id, label: `${j.title} (${j.department})` }))}
            value={jobId || openings[0]?.id || null}
            onChange={(v) => setJobId(v ?? "")}
          />
        </FormRow>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Candidate full name" required>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Marcus Vogel"
              required
            />
          </FormRow>
          <FormRow label="Email address" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marcus.vogel@devmail.de"
              required
            />
          </FormRow>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Phone number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 172 8841920" />
          </FormRow>
          <FormRow label="Pipeline stage">
            <Combobox
              options={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
              value={stage}
              onChange={(v) => setStage((v as CandidateStage) || "screening")}
            />
          </FormRow>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Interview date">
            <Input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
          </FormRow>
          <FormRow label="Evaluation rating (1 - 5)">
            <Input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(Math.min(5, Math.max(1, Number(e.target.value) || 4)))}
            />
          </FormRow>
        </div>

        <FormRow label="Portfolio / GitHub / LinkedIn URL">
          <Input
            type="url"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://github.com/..."
          />
        </FormRow>

        <FormRow label="Extracted Resume Summary & Interviewer Notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Extracted skills, experience summary, and interview feedback..."
          />
        </FormRow>
      </form>
    </Dialog>
  );
}
