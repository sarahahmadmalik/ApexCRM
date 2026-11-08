"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  FileBadge,
  FilePlus2,
  FileText,
  Hash,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  SearchX,
  Trash2,
  UserPlus,
  Users,
  CheckCircle2,
  Clock,
  Hourglass,
} from "lucide-react";
import type { Database, EmploymentType } from "@/lib/types/database";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { ContractFormDialog } from "@/components/contracts/contract-form-dialog";
import { deleteEmployee, downloadContractDocument } from "@/app/(app)/employees/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CountryFlag } from "@/components/ui/country-flag";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DownloadMenu } from "@/components/ui/download-menu";
import { avatarTint, cn, EMPLOYMENT_TYPE_LABELS } from "@/lib/utils";
import { useCanWrite } from "@/components/auth/permissions-provider";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Contract = { id: string; employee_id: string; file_path: string | null; status: string; created_at: string };

const PAGE_SIZE = 8;
const ENDING_SOON_DAYS = 30;

const STATUS_OPTIONS = [
  { value: "ALL", label: "All staff" },
  { value: "ACTIVE", label: "Contract active" },
  { value: "PENDING", label: "Contract pending" },
  { value: "ENDING", label: "Ending soon / ended" },
];

const EMPLOYMENT_ICON: Record<EmploymentType, React.ComponentType<{ className?: string }>> = {
  full_time: Briefcase,
  part_time: CalendarClock,
  contract: FileBadge,
};

function toDate(value: string | null) {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * Where an employee's contract stands today, derived from `has_contract` and
 * the duration dates. Drives the card's panel, status pill and highlight.
 */
type Lifecycle =
  | { kind: "pending"; onboardedPct: number; missing: string }
  | { kind: "upcoming"; startsIn: number; pct: 0 }
  | { kind: "running"; pct: number; daysLeft: number }
  | { kind: "ending"; pct: number; daysLeft: number }
  | { kind: "ended"; endedAgo: number; pct: 100 }
  | { kind: "open"; since: Date | null };

function lifecycleOf(emp: Employee, today: Date): Lifecycle {
  const start = toDate(emp.contract_start_date);
  const end = toDate(emp.contract_end_date);

  if (!emp.has_contract) {
    const checks = [emp.full_name, emp.position, emp.country, emp.email, emp.phone, emp.contract_start_date];
    const filled = checks.filter((v) => v && String(v).trim()).length;
    // The contract itself is the last onboarding step, so cap below 100%.
    const onboardedPct = Math.round((filled / (checks.length + 1)) * 100);
    const missing = !emp.email
      ? "Missing email"
      : !emp.contract_start_date
        ? "Missing start date"
        : "Missing contract";
    return { kind: "pending", onboardedPct, missing };
  }

  if (start && start > today) return { kind: "upcoming", startsIn: differenceInCalendarDays(start, today), pct: 0 };

  if (start && end) {
    const daysLeft = differenceInCalendarDays(end, today);
    if (daysLeft < 0) return { kind: "ended", endedAgo: -daysLeft, pct: 100 };
    const total = Math.max(1, differenceInCalendarDays(end, start));
    const pct = Math.min(100, Math.max(0, Math.round((differenceInCalendarDays(today, start) / total) * 100)));
    return daysLeft <= ENDING_SOON_DAYS ? { kind: "ending", pct, daysLeft } : { kind: "running", pct, daysLeft };
  }

  return { kind: "open", since: start };
}

function shortDate(d: Date | null) {
  return d ? format(d, "dd MMM yyyy") : "—";
}

export function EmployeesCards({ employees, contracts }: { employees: Employee[]; contracts: Contract[] }) {
  const [editing, setEditing] = useState<Employee | null>(null);
  const [adding, setAdding] = useState(0);
  const canEdit = useCanWrite("employees");
  const canGenerate = useCanWrite("contracts");
  const [contractFor, setContractFor] = useState<Employee | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [countryFilter, setCountryFilter] = useState<string | null>("ALL");
  const [statusFilter, setStatusFilter] = useState<string | null>("ALL");
  const [page, setPage] = useState(1);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const today = useMemo(() => startOfDay(new Date()), []);
  const lifecycles = useMemo(
    () => new Map(employees.map((e) => [e.id, lifecycleOf(e, today)])),
    [employees, today]
  );

  const uniqueCountries = Array.from(new Set(employees.map((e) => e.country).filter(Boolean))).sort() as string[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const life = lifecycles.get(emp.id)!;
      const matchesSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        (emp.position ?? "").toLowerCase().includes(q) ||
        (emp.email ?? "").toLowerCase().includes(q);
      const matchesCountry = !countryFilter || countryFilter === "ALL" || emp.country === countryFilter;
      const matchesStatus =
        !statusFilter || statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
            ? emp.has_contract
            : statusFilter === "PENDING"
              ? !emp.has_contract
              : life.kind === "ending" || life.kind === "ended";
      return matchesSearch && matchesCountry && matchesStatus;
    });
  }, [employees, lifecycles, search, countryFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const total = employees.length;
  const activeContracts = employees.filter((e) => e.has_contract).length;
  const pending = total - activeContracts;
  const endingSoon = Array.from(lifecycles.values()).filter((l) => l.kind === "ending" || l.kind === "ended").length;
  const activePct = total ? Math.round((activeContracts / total) * 100) : 0;

  const activeFilterCount =
    (countryFilter && countryFilter !== "ALL" ? 1 : 0) + (statusFilter && statusFilter !== "ALL" ? 1 : 0);

  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function clearFilters() {
    setSearch("");
    setCountryFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  }

  async function handleDelete(e: Employee) {
    setBusyId(e.id);
    try {
      await deleteEmployee(e.id);
      toast.success("Employee removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove employee");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* KPI strip — same card language as the Overview page */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          className="card-in card-in-1"
          label="Total team size"
          value={total}
          icon={Users}
          tone="neutral"
          footer={
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              across {uniqueCountries.length} {uniqueCountries.length === 1 ? "country" : "countries"}
            </span>
          }
        />
        <KpiCard
          className="card-in card-in-2"
          label="Contracts active"
          value={activeContracts}
          icon={CheckCircle2}
          tone="emerald"
          footer={
            <>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {activePct}% covered
              </span>
              <MiniBar pct={activePct} className="bg-emerald-500" />
            </>
          }
        />
        <KpiCard
          className="card-in card-in-3"
          label="Onboarding pending"
          value={pending}
          icon={Clock}
          tone="amber"
          footer={
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {pending === 0 ? "everyone is contracted" : "need a contract generated"}
            </span>
          }
        />
        <KpiCard
          className="card-in card-in-4"
          label="Ending ≤ 30 days"
          value={endingSoon}
          icon={Hourglass}
          tone={endingSoon > 0 ? "rose" : "brand"}
          footer={
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {endingSoon === 0 ? "no renewals due" : "contracts to renew or close"}
            </span>
          }
        />
      </div>

      {total === 0 ? (
        <RosterEmptyState canAdd={canEdit} onAdd={() => setAdding((n) => n + 1)} />
      ) : (
        <>
          <FilterBar
            activeCount={activeFilterCount}
            onClearAll={clearFilters}
            search={{ value: search, onChange: withReset(setSearch), placeholder: "Search employees..." }}
          >
            <Combobox
              options={[{ value: "ALL", label: "All regions" }, ...uniqueCountries.map((c) => ({ value: c, label: c }))]}
              value={countryFilter}
              onChange={withReset(setCountryFilter)}
              placeholder="All regions"
            />
            <Combobox
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={withReset(setStatusFilter)}
              placeholder="All staff"
            />
          </FilterBar>

          {pageRows.length === 0 ? (
            <Card className="flex min-h-[320px] flex-col items-center justify-center border-dashed px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500">
                <SearchX className="h-6 w-6" />
              </div>
              <p className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
                No employees match these filters
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                Try a different name, region or contract status.
              </p>
              <Button variant="outline" size="sm" className="mt-5" onClick={clearFilters}>
                Clear filters
              </Button>
            </Card>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {pageRows.map((emp, index) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  tintIndex={(currentPage - 1) * PAGE_SIZE + index}
                  life={lifecycles.get(emp.id)!}
                  latestContract={contracts.find((c) => c.employee_id === emp.id)}
                  busy={busyId === emp.id}
                  canEdit={canEdit}
                  canGenerate={canGenerate}
                  onEdit={() => setEditing(emp)}
                  onGenerate={() => setContractFor(emp)}

                  onRemove={() =>
                    confirm({
                      title: "Remove employee",
                      message: (
                        <>
                          <strong className="font-semibold text-gray-900 dark:text-gray-100">{emp.full_name}</strong>{" "}
                          will be removed from the roster. This can&apos;t be undone.
                        </>
                      ),
                      confirmLabel: "Remove",
                      onConfirm: () => handleDelete(emp),
                    })
                  }
                />
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-navy-900">
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {confirmDialog}

      {adding > 0 && <EmployeeFormDialog key={adding} open onClose={() => setAdding(0)} />}
      {editing && (
        <EmployeeFormDialog key={editing.id} open={!!editing} onClose={() => setEditing(null)} employee={editing} />
      )}
      {contractFor && (
        <ContractFormDialog
          key={contractFor.id}
          open={!!contractFor}
          onClose={() => setContractFor(null)}
          employees={[contractFor]}
          defaultEmployeeId={contractFor.id}
        />
      )}
    </>
  );
}

/* ─── Employee card ─────────────────────────────────────────────────────── */

function EmployeeCard({
  emp,
  tintIndex,
  life,
  latestContract,
  busy,
  canEdit,
  canGenerate,
  onEdit,
  onGenerate,
  onRemove,
}: {
  emp: Employee;
  tintIndex: number;
  life: Lifecycle;
  latestContract?: Contract;
  busy: boolean;
  canEdit: boolean;
  canGenerate: boolean;
  onEdit: () => void;
  onGenerate: () => void;
  onRemove: () => void;
}) {
  const employmentType = emp.employment_type ?? "full_time";
  const EmploymentIcon = EMPLOYMENT_ICON[employmentType];
  const needsAction = life.kind === "pending" || life.kind === "ended";
  const initials = emp.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md sm:p-6 dark:bg-navy-900",
        needsAction
          ? "border-brand-400 ring-2 ring-brand-400/40 dark:border-brand-400/70 dark:ring-brand-400/20"
          : "border-gray-200 dark:border-white/10"
      )}
    >
      {needsAction && (
        <span
          className={cn(
            "absolute -top-px -right-px rounded-tr-2xl rounded-bl-xl px-3 py-1 text-xs font-bold text-white shadow-sm",
            life.kind === "ended" ? "bg-rose-500" : "bg-amber-500"
          )}
        >
          Action required
        </span>
      )}

      {/* Identity */}
      <div className={cn("flex items-start gap-3 sm:gap-4", needsAction && "pt-5")}>
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ring-1 ring-inset sm:h-16 sm:w-16 sm:text-xl",
              avatarTint(tintIndex)
            )}
          >
            {initials}
          </div>
          <span
            title={emp.has_contract ? "Contract active" : "Contract pending"}
            className={cn(
              "absolute right-0 bottom-0 h-4 w-4 rounded-full ring-[3px] ring-white dark:ring-navy-900",
              emp.has_contract ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="font-display truncate text-lg leading-tight font-bold text-gray-900 sm:text-xl dark:text-gray-100"
            title={emp.full_name}
          >
            {emp.full_name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400" title={emp.position ?? undefined}>
            {emp.position || "Team member"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {emp.country && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                <CountryFlag country={emp.country} />
                {emp.country}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
              <EmploymentIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
              {EMPLOYMENT_TYPE_LABELS[employmentType]}
            </span>
            <span
              className="font-mono-brand inline-flex items-center gap-0.5 text-xs text-gray-400 dark:text-gray-500"
              title={emp.id}
            >
              <Hash className="h-3 w-3" />
              {emp.id.slice(0, 4).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ContactButton href={emp.phone ? `tel:${emp.phone}` : undefined} label={emp.phone ?? "No phone on file"}>
            <Phone className="h-4 w-4" />
          </ContactButton>
          <ContactButton href={emp.email ? `mailto:${emp.email}` : undefined} label={emp.email ?? "No email on file"}>
            <Mail className="h-4 w-4" />
          </ContactButton>
          {canEdit && (
          <DropdownMenu
            align="right"
            panelClassName="w-40 p-1"
            trigger={({ toggle }) => (
              <button
                onClick={toggle}
                aria-label="Employee actions"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close();
                    onEdit();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <Pencil className="h-4 w-4 text-gray-400" />
                  Edit profile
                </button>
                <button
                  onClick={() => {
                    close();
                    onRemove();
                  }}
                  disabled={busy}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </>
            )}
          </DropdownMenu>
          )}
        </div>
      </div>

      {/* Contract panel */}
      <div className="mt-5 flex-1">
        <ContractPanel emp={emp} life={life} latestContract={latestContract} />
      </div>

      {/* Status + primary action */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <StatusPill life={life} />

        {latestContract ? (
          <DownloadMenu
            variant="button"
            label="View contract"
            onDownload={(format) => downloadContractDocument(latestContract.id, format)}
          />
        ) : !canGenerate ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">No contract yet</span>
        ) : (
          <button
            onClick={onGenerate}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:shadow-[0_0_0_3px_rgba(6,182,212,0.2)] dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <FilePlus2 className="h-4 w-4" />
            Generate contract
          </button>
        )}
      </div>
    </article>
  );
}

function ContactButton({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const base = "flex h-9 w-9 items-center justify-center rounded-full transition-colors";
  if (!href) {
    return (
      <span
        title={label}
        aria-label={label}
        className={cn(base, "cursor-not-allowed bg-gray-50 text-gray-300 dark:bg-white/5 dark:text-gray-600")}
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        base,
        "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
      )}
    >
      {children}
    </a>
  );
}

function ContractPanel({ emp, life, latestContract }: { emp: Employee; life: Lifecycle; latestContract?: Contract }) {
  const start = toDate(emp.contract_start_date);
  const end = toDate(emp.contract_end_date);
  const docLabel = latestContract ? `Doc #CTR-${latestContract.id.slice(0, 6).toUpperCase()}` : "No document yet";

  if (life.kind === "pending") {
    return (
      <div className="h-full rounded-xl bg-amber-50/70 p-4 ring-1 ring-amber-200/60 ring-inset dark:bg-amber-500/[0.07] dark:ring-amber-400/15">
        <PanelHeader
          label="Onboarding progress"
          value={`${life.onboardedPct}% onboarded`}
          valueClass="text-amber-600 dark:text-amber-400"
        />
        <Bar pct={life.onboardedPct} className="bg-amber-500" />
        <div className="font-mono-brand mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-bold text-amber-600 dark:text-amber-400">{life.missing}</span>
          <span className="text-gray-600 dark:text-gray-400">
            Start: {start ? format(start, "MMM yyyy") : "not set"}
          </span>
        </div>
      </div>
    );
  }

  const header =
    life.kind === "running"
      ? { label: "Contract duration", value: `${life.daysLeft} days left`, cls: "text-gray-900 dark:text-gray-100" }
      : life.kind === "ending"
        ? {
            label: "Contract duration",
            value: life.daysLeft === 0 ? "Ends today" : `${life.daysLeft} days left`,
            cls: "text-amber-600 dark:text-amber-400",
          }
        : life.kind === "ended"
          ? { label: "Contract duration", value: `Ended ${life.endedAgo}d ago`, cls: "text-rose-600 dark:text-rose-400" }
          : life.kind === "upcoming"
            ? { label: "Contract duration", value: `Starts in ${life.startsIn}d`, cls: "text-brand-700 dark:text-brand-300" }
            : { label: "Employment", value: life.since ? "Open-ended" : "Start date not set", cls: "text-gray-900 dark:text-gray-100" };

  const pct = life.kind === "open" ? (life.since ? 100 : 0) : life.pct;
  const barClass =
    life.kind === "ending" ? "bg-amber-500" : life.kind === "ended" ? "bg-rose-500" : "bg-brand-700 dark:bg-brand-500";

  return (
    <div className="h-full rounded-xl bg-gray-50 p-4 dark:bg-white/5">
      <PanelHeader label={header.label} value={header.value} valueClass={header.cls} />
      <Bar pct={pct} className={barClass} />
      <div className="font-mono-brand mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
          {start ? `${shortDate(start)}${end ? ` → ${shortDate(end)}` : ""}` : docLabel}
        </span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {start ? docLabel.replace("Doc ", "") : latestContract?.status === "final" ? "Final" : "Draft"}
        </span>
      </div>
    </div>
  );
}

function PanelHeader({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      <span className={cn("text-sm font-bold whitespace-nowrap", valueClass)}>{value}</span>
    </div>
  );
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusPill({ life }: { life: Lifecycle }) {
  const config =
    life.kind === "pending"
      ? {
          icon: AlertTriangle,
          label: "No contract generated",
          cls: "bg-amber-100/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        }
      : life.kind === "ended"
        ? { icon: CalendarX2, label: "Contract ended", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" }
        : life.kind === "ending"
          ? {
              icon: CalendarClock,
              label: "Ending soon",
              cls: "bg-amber-100/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
            }
          : {
              icon: BadgeCheck,
              label: life.kind === "upcoming" ? "Contract signed" : "Contract active",
              cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
            };
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold", config.cls)}>
      <Icon className="h-4 w-4 shrink-0" />
      {config.label}
    </span>
  );
}

/* ─── KPI + empty state ─────────────────────────────────────────────────── */

const TONE: Record<string, string> = {
  neutral: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  footer,
  className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col justify-between p-5 transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            {label}
          </span>
          <span className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
            {value.toLocaleString()}
          </span>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", TONE[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">{footer}</div>
    </Card>
  );
}

function MiniBar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
      <div className={cn("h-1.5 rounded-full", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RosterEmptyState({ onAdd, canAdd }: { onAdd: () => void; canAdd: boolean }) {
  return (
    <Card className="relative overflow-hidden border-dashed px-6 py-16 text-center sm:py-20">
      <div className="mx-auto mb-6 flex w-fit items-center">
        {[UserPlus, FileText, BadgeCheck].map((Icon, i) => (
          <div
            key={i}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white shadow-sm dark:border-navy-900",
              i === 1 ? "z-10 -mx-2 scale-110 bg-brand-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        ))}
      </div>
      <h3 className="font-display text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-100">
        Build your team roster
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        No employees yet. Add your first team member with their contract dates, and you can generate their contract
        in the same step.
      </p>
      {canAdd && (
        <Button variant="primary" className="mt-6" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add first employee
        </Button>
      )}
    </Card>
  );
}
