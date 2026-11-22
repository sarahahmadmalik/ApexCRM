import { User, Briefcase, CalendarRange, Wallet, FileSignature, UserX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { DownloadMenu } from "@/components/ui/download-menu";
import { Badge } from "@/components/ui/badge";
import { AppearanceCard } from "@/components/profile/appearance-card";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsTabs, type SettingsTab } from "@/components/profile/settings-tabs";
import { AssistantCard } from "@/components/profile/assistant-card";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { LocationTile } from "@/components/profile/location-tile";
import { getCurrentAppUser, createClient } from "@/lib/supabase/server";
import { downloadContractDocument } from "@/app/(app)/employees/actions";
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatSalary } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  const supabase = await createClient();

  // Best-effort link to the employee roster by email — app_users
  // (leadership) and employees are separate tables with no formal foreign
  // key between them, so this is the closest we can match on.
  const { data: employee } = appUser.email
    ? await supabase.from("employees").select("*").eq("email", appUser.email).maybeSingle()
    : { data: null };

  const { data: latestContract } = employee
    ? await supabase
        .from("contracts")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const aiEnabled = !!process.env.OPENROUTER_KEY;
  const tabs: SettingsTab[] = [
    {
      id: "account",
      label: "Account",
      content: (
        <>
      <Card>
        <CardHeader title="Account" description={`Your access in the ${appUser.workspaceName} workspace, managed by the workspace admin.`} />
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{appUser.full_name}</p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{appUser.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-500/10 dark:text-brand-300">
                {appUser.role}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:bg-white/10 dark:text-slate-300">
                {appUser.isAdmin ? "Admin" : "User"} account
              </span>
            </div>
          </div>
        </div>
      </Card>
        </>
      ),
    },
    {
      id: "employment",
      label: "Employment",
      content: (
        <>
      <Card>
        <CardHeader
          title="Employment"
          description={
            employee
              ? "Your role, start date and salary, as recorded on the team roster."
              : "Your employment record on the team roster."
          }
        />
        {employee ? (
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile icon={Briefcase} label="Position" value={employee.position || "Team member"} />
              <InfoTile
                icon={CalendarRange}
                label="Employed since"
                value={formatDate(employee.contract_start_date)}
                sub={employee.contract_end_date ? `Until ${formatDate(employee.contract_end_date)}` : "Open-ended"}
              />
              <InfoTile icon={Wallet} label="Salary" value={formatSalary(employee.salary_amount, employee.salary_period)} />
              <InfoTile
                icon={FileSignature}
                label="Employment type"
                value={EMPLOYMENT_TYPE_LABELS[employee.employment_type]}
              />
              <LocationTile country={employee.country} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your signed contract</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {latestContract
                    ? latestContract.status === "final"
                      ? "Ready to view and download."
                      : "Data saved — the document template is still pending."
                    : "No contract has been generated for you yet."}
                </p>
              </div>
              {latestContract ? (
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      latestContract.status === "final"
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300"
                    }
                  >
                    {latestContract.status === "final" ? "Document ready" : "Template pending"}
                  </Badge>
                  <DownloadMenu
                    variant="button"
                    label="View contract"
                    onDownload={(format) => downloadContractDocument(latestContract.id, format)}
                  />
                </div>
              ) : (
                <Badge className="bg-gray-100 text-gray-500 ring-gray-400/20 dark:bg-white/10 dark:text-gray-400">
                  Not generated
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500">
              <UserX className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No linked employee record</p>
            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
              No entry on the team roster matches {appUser.email ?? "your account email"}. Ask a leadership account
              to add or update an employee record with this email address to see your employment details here.
            </p>
          </div>
        )}
      </Card>
        </>
      ),
    },
    { id: "appearance", label: "Appearance", content: <AppearanceCard /> },
    ...(aiEnabled ? [{ id: "assistant" as const, label: "AI assistant", content: <AssistantCard /> }] : []),
    { id: "security", label: "Security", content: <ChangePasswordCard /> },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Your account, appearance and security on ApexCRM." />
      <SettingsTabs tabs={tabs} initialTab={tab} />
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="truncate text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}
