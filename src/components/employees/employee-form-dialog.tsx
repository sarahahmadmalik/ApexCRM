"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, CalendarClock, FileBadge } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormRow, Input, Textarea, Toggle } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { ContractDurationFields, type ContractDuration } from "@/components/employees/contract-duration-fields";
import { COUNTRY_NAMES } from "@/lib/data/geo";
import type { Database, EmploymentType, SalaryPeriod } from "@/lib/types/database";
import { EMPLOYMENT_TYPE_LABELS, cn } from "@/lib/utils";
import {
  collectErrors,
  parseAmount,
  validateContractDates,
  validateEmail,
  validatePhone,
  validateRequired,
  validateSalary,
} from "@/lib/validation";
import { createEmployee, updateEmployee, type ContractData } from "@/app/(app)/employees/actions";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

const EMPLOYMENT_OPTIONS: { value: EmploymentType; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { value: "full_time", icon: Briefcase, hint: "Permanent staff" },
  { value: "part_time", icon: CalendarClock, hint: "Reduced hours" },
  { value: "contract", icon: FileBadge, hint: "Fixed term" },
];

const SALARY_PERIOD_OPTIONS = [
  { value: "month", label: "per month" },
  { value: "year", label: "per year" },
];

export function EmployeeFormDialog({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}) {
  const isEdit = !!employee;
  const [country, setCountry] = useState<string | null>(employee?.country ?? null);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employee?.employment_type ?? "full_time");
  const [duration, setDuration] = useState<ContractDuration>({
    start: employee?.contract_start_date ?? "",
    end: employee?.contract_end_date ?? "",
  });
  const [salaryAmount, setSalaryAmount] = useState(employee?.salary_amount != null ? String(employee.salary_amount) : "");
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(employee?.salary_period ?? "month");
  const [generateContract, setGenerateContract] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Date errors re-validate live once the user has tried to submit, so a fix
  // clears the message immediately instead of on the next save.
  const [submitted, setSubmitted] = useState(false);

  const isContractRole = employmentType === "contract";
  const requireStart = isContractRole || generateContract;
  const requireEnd = isContractRole;
  const requireSalary = generateContract;

  function dateErrorsFor(next: ContractDuration, type = employmentType, withContract = generateContract) {
    return validateContractDates({
      start: next.start,
      end: next.end,
      requireStart: type === "contract" || withContract,
      requireEnd: type === "contract",
    });
  }

  function refreshDateErrors(next: ContractDuration, type?: EmploymentType, withContract?: boolean) {
    const found = dateErrorsFor(next, type, withContract);
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest.start_date;
      delete rest.end_date;
      return collectErrors({ ...rest, start_date: found.start, end_date: found.end });
    });
  }

  function handleDurationChange(next: ContractDuration) {
    setDuration(next);
    // The end-before-start rule is worth flagging as soon as both are picked.
    if (submitted || (next.start && next.end)) refreshDateErrors(next);
  }

  function handleTypeChange(type: EmploymentType) {
    setEmploymentType(type);
    if (submitted) refreshDateErrors(duration, type);
  }

  function handleGenerateToggle(on: boolean) {
    setGenerateContract(on);
    if (submitted) {
      refreshDateErrors(duration, undefined, on);
      setErrors((prev) => collectErrors({ ...prev, salary: validateSalary(salaryAmount, salaryPeriod, { required: on }) }));
    }
  }

  function handleSalaryChange(amount: string, period: SalaryPeriod) {
    setSalaryAmount(amount);
    setSalaryPeriod(period);
    if (submitted) {
      setErrors((prev) =>
        collectErrors({ ...prev, salary: validateSalary(amount, period, { required: requireSalary }) })
      );
    }
  }

  async function handleSubmit(formData: FormData) {
    setSubmitted(true);
    const parsedSalary = parseAmount(salaryAmount);
    const input = {
      full_name: String(formData.get("full_name") ?? "").trim(),
      country: country ?? "",
      position: String(formData.get("position") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      employment_type: employmentType,
      contract_start_date: duration.start || null,
      contract_end_date: duration.end || null,
      salary_amount: parsedSalary,
      salary_period: parsedSalary != null ? salaryPeriod : null,
    };
    const dateErrors = dateErrorsFor(duration);
    const salaryError = validateSalary(salaryAmount, salaryPeriod, { required: requireSalary });

    const found = collectErrors({
      full_name: validateRequired(input.full_name, "Full name"),
      email: validateEmail(input.email),
      phone: validatePhone(input.phone),
      start_date: dateErrors.start,
      end_date: dateErrors.end,
      salary: salaryError,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateEmployee(employee!.id, input);
        toast.success("Employee updated");
      } else {
        let contract: ContractData | undefined;
        if (generateContract) {
          contract = {
            start_date: duration.start,
            end_date: duration.end || null,
            position: input.position,
            salary_amount: parsedSalary!,
            salary_period: salaryPeriod,
            notes: String(formData.get("contract_notes") ?? ""),
          };
        }
        await createEmployee(input, contract);
        toast.success(generateContract ? "Employee added and contract saved" : "Employee added");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit employee" : "Add new employee"}
      description="Team member details, contract duration, and optionally a contract."
      size="md"
      position="right"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={saving} loading={saving} variant="outline-brand">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add employee"}
          </Button>
        </div>
      }
    >
      <form id="employee-form" action={handleSubmit} noValidate className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Full name" required error={errors.full_name}>
              <Input name="full_name" defaultValue={employee?.full_name} placeholder="e.g. Alex Vance" />
            </FormRow>
            <FormRow label="Position">
              <Input name="position" defaultValue={employee?.position ?? ""} placeholder="e.g. Software Engineer" />
            </FormRow>
            <FormRow label="Country">
              <Combobox
                options={COUNTRY_NAMES.map((c) => ({ value: c, label: c }))}
                value={country}
                onChange={setCountry}
                placeholder="Search country..."
                isClearable
              />
            </FormRow>
            <FormRow label="Email" error={errors.email}>
              <Input name="email" type="email" defaultValue={employee?.email ?? ""} placeholder="name@apexcrm.io" />
            </FormRow>
            <div className="sm:col-span-2">
              <FormRow label="Phone" error={errors.phone}>
                <Input name="phone" defaultValue={employee?.phone ?? ""} placeholder="+49 151 234 5678" />
              </FormRow>
            </div>
          </div>

          {/* Employment type — all three stay selectable; picking "Contract"
              only makes the duration below mandatory. */}
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Employment type
            </p>
            <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {EMPLOYMENT_OPTIONS.map(({ value, icon: Icon, hint }) => {
                const selected = employmentType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleTypeChange(value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                      selected
                        ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-navy-800 dark:hover:border-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        selected
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          selected ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-gray-200"
                        )}
                      >
                        {EMPLOYMENT_TYPE_LABELS[value]}
                      </span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contract duration</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isContractRole
                  ? "Contract roles need both a start and an end date."
                  : "When this person starts, and when the role ends if it's fixed-term."}
              </p>
            </div>
            <ContractDurationFields
              value={duration}
              onChange={handleDurationChange}
              errors={{ start: errors.start_date, end: errors.end_date }}
              requireStart={requireStart}
              requireEnd={requireEnd}
            />
          </div>

          <FormRow
            label="Salary"
            required={requireSalary}
            error={errors.salary}
            hint={requireSalary ? undefined : "Optional. Set the amount per month or per year."}
          >
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={salaryAmount}
                onChange={(e) => handleSalaryChange(e.target.value, salaryPeriod)}
                placeholder="e.g. 4.500 or 55.000"
                className="flex-1"
              />
              <div className="w-36 shrink-0">
                <Combobox
                  options={SALARY_PERIOD_OPTIONS}
                  value={salaryPeriod}
                  onChange={(v) => handleSalaryChange(salaryAmount, (v as SalaryPeriod) ?? "month")}
                />
              </div>
            </div>
          </FormRow>

          {!isEdit && (
            <div className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20">
              <Toggle
                checked={generateContract}
                onChange={handleGenerateToggle}
                label="Generate a contract for this employee"
              />

              {generateContract && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The contract uses the duration and salary above, and both are required.
                  </p>
                  <FormRow label="Notes" hint="Anything else to include in the contract">
                    <Textarea name="contract_notes" rows={2} placeholder="e.g. Probation period of 6 months" />
                  </FormRow>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}
