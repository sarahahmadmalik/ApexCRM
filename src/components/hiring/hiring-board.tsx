"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  Calendar,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
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
import type { CandidateStage, Database, EmploymentType, JobOpeningStatus } from "@/lib/types/database";
import {
  createCandidate,
  createJobOpening,
  deleteCandidate,
  deleteJobOpening,
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
  interview: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300",
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
    try {
      if (!isDemoFallback) await deleteCandidate(candidate.id);
      toast.success("Candidate removed");
    } catch (err) {
      setCandidates(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't remove candidate");
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
              <UserPlus className="h-4 w-4" />
              Add Candidate
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
          search={{ value: search, onChange: setSearch, placeholder: "Search candidates by name, email or role..." }}
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
                      return (
                        <Card
                          key={c.id}
                          className="flex flex-col justify-between gap-3 p-4 transition-shadow hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
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
                                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {c.full_name}
                                  </p>
                                  <p className="truncate text-xs text-brand-600 dark:text-brand-400">
                                    {job?.title ?? "General Application"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {c.notes && (
                              <p className="mt-2.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{c.notes}</p>
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
                              <a
                                href={`mailto:${c.email}`}
                                title={c.email}
                                className="rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                              {c.phone && (
                                <a
                                  href={`tel:${c.phone}`}
                                  title={c.phone}
                                  className="rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
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
          <table className="w-full min-w-[880px] table-fixed text-sm">
            <TableHead
              columns={[
                { label: "Candidate", width: "w-[25%]" },
                { label: "Role & Department", width: "w-[25%]" },
                { label: "Interview", width: "w-[14%]" },
                { label: "Evaluation", width: "w-[12%]" },
                { label: "Stage", width: "w-[14%]" },
                { label: "Actions", align: "right", width: "w-[10%]" },
              ]}
            />
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filteredCandidates.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  icon={Users}
                  title="No candidates found"
                  description="Adjust your filters or add a new candidate to the pipeline."
                />
              ) : (
                filteredCandidates.map((c, idx) => {
                  const job = jobById.get(c.job_id);
                  return (
                    <tr key={c.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                              avatarTint(idx)
                            )}
                          >
                            {c.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 dark:text-gray-100">{c.full_name}</p>
                            <p className="truncate text-xs text-gray-400 dark:text-gray-500">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">{job?.title ?? "—"}</p>
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {job ? `${job.department} · ${job.location}` : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {c.interview_date ? formatDate(c.interview_date) : "Not scheduled"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: c.rating }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </span>
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
                          {c.portfolio_url && (
                            <a
                              href={c.portfolio_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open portfolio"
                              className="rounded-md p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
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
                      <strong className="text-indigo-600 dark:text-indigo-400">{interviewCount}</strong> in interview
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

      {/* Add Candidate Modal */}
      <AddCandidateDialog
        open={showAddCandidate}
        onClose={() => setShowAddCandidate(false)}
        openings={openings}
        isDemoFallback={isDemoFallback}
        onCreated={(cand) => setCandidates((cur) => [cand, ...cur])}
      />
    </div>
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
  const [jobId, setJobId] = useState<string>(openings[0]?.id ?? "");
  const [stage, setStage] = useState<CandidateStage>("applied");

  async function handleSubmit(formData: FormData) {
    const full_name = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const interview_date = String(formData.get("interview_date") ?? "").trim();
    const portfolio_url = String(formData.get("portfolio_url") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const rating = Number(formData.get("rating") ?? 4);
    const targetJobId = jobId || openings[0]?.id;

    if (!full_name || !email || !targetJobId) {
      toast.error("Please fill in candidate name, email, and role.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemoFallback) {
        await createCandidate({
          job_id: targetJobId,
          full_name,
          email,
          phone,
          stage,
          rating,
          interview_date: interview_date || null,
          portfolio_url,
          notes,
        });
      }
      onCreated({
        id: crypto.randomUUID(),
        job_id: targetJobId,
        full_name,
        email,
        phone: phone || null,
        stage,
        rating,
        interview_date: interview_date || null,
        portfolio_url: portfolio_url || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Candidate added to pipeline");
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
      onClose={onClose}
      title="Add candidate to ATS"
      description="Track a new applicant across screening, interviews, and offer stages."
      position="right"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-candidate-form" variant="outline-brand" loading={saving}>
            <UserPlus className="h-4 w-4" />
            Save candidate
          </Button>
        </div>
      }
    >
      <form id="add-candidate-form" action={handleSubmit} className="space-y-4">
        <FormRow label="Job opening" required>
          <Combobox
            options={openings.map((j) => ({ value: j.id, label: `${j.title} (${j.department})` }))}
            value={jobId || openings[0]?.id || null}
            onChange={(v) => setJobId(v ?? "")}
          />
        </FormRow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Full name" required>
            <Input name="full_name" placeholder="e.g. Hannah Fischer" required />
          </FormRow>
          <FormRow label="Email" required>
            <Input name="email" type="email" placeholder="hannah@example.de" required />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Phone">
            <Input name="phone" placeholder="+49 170 1234567" />
          </FormRow>
          <FormRow label="Pipeline stage">
            <Combobox
              options={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
              value={stage}
              onChange={(v) => setStage((v as CandidateStage) || "applied")}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Interview date">
            <Input name="interview_date" type="date" />
          </FormRow>
          <FormRow label="Rating (1 - 5)">
            <Input name="rating" type="number" min={1} max={5} defaultValue={4} />
          </FormRow>
        </div>
        <FormRow label="Portfolio / LinkedIn / GitHub URL">
          <Input name="portfolio_url" type="url" placeholder="https://github.com/..." />
        </FormRow>
        <FormRow label="Interviewer notes">
          <Textarea name="notes" rows={3} placeholder="Key strengths, salary expectations, notice period..." />
        </FormRow>
      </form>
    </Dialog>
  );
}
