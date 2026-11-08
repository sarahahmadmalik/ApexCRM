"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormRow, Input, Textarea } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { ContractDurationFields, type ContractDuration } from "@/components/employees/contract-duration-fields";
import { collectErrors, parseAmount, validateContractDates, validateSalary } from "@/lib/validation";
import type { Database, SalaryPeriod } from "@/lib/types/database";
import { createContract } from "@/app/(app)/employees/actions";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

const SALARY_PERIOD_OPTIONS = [
  { value: "month", label: "per month" },
  { value: "year", label: "per year" },
];

export function ContractFormDialog({
  open,
  onClose,
  employees,
  defaultEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  defaultEmployeeId?: string;
}) {
  const [employeeId, setEmployeeId] = useState<string | null>(defaultEmployeeId ?? null);
  const selected = employees.find((e) => e.id === employeeId);
  const [duration, setDuration] = useState<ContractDuration>({
    start: selected?.contract_start_date ?? "",
    end: selected?.contract_end_date ?? "",
  });
  const [salaryAmount, setSalaryAmount] = useState(selected?.salary_amount != null ? String(selected.salary_amount) : "");
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(selected?.salary_period ?? "month");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const requireEnd = selected?.employment_type === "contract";

  function dateErrorsFor(next: ContractDuration) {
    return validateContractDates({ start: next.start, end: next.end, requireStart: true, requireEnd });
  }

  function handleEmployeeChange(id: string | null) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    // Prefill from the employee record when there's nothing typed yet.
    if (emp && !duration.start && !duration.end) {
      setDuration({ start: emp.contract_start_date ?? "", end: emp.contract_end_date ?? "" });
    }
    if (emp && !salaryAmount && emp.salary_amount != null) {
      setSalaryAmount(String(emp.salary_amount));
      setSalaryPeriod(emp.salary_period ?? "month");
    }
  }

  function handleDurationChange(next: ContractDuration) {
    setDuration(next);
    if (submitted || (next.start && next.end)) {
      const found = dateErrorsFor(next);
      setErrors((prev) => {
        const rest = { ...prev };
        delete rest.start_date;
        delete rest.end_date;
        return collectErrors({ ...rest, start_date: found.start, end_date: found.end });
      });
    }
  }

  function handleSalaryChange(amount: string, period: SalaryPeriod) {
    setSalaryAmount(amount);
    setSalaryPeriod(period);
    if (submitted) {
      setErrors((prev) => collectErrors({ ...prev, salary: validateSalary(amount, period, { required: true }) }));
    }
  }

  async function handleSubmit(formData: FormData) {
    setSubmitted(true);
    const dateErrors = dateErrorsFor(duration);
    const salaryError = validateSalary(salaryAmount, salaryPeriod, { required: true });
    const found = collectErrors({
      employee: employeeId ? undefined : "Pick an employee first",
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
      await createContract(
        employeeId!,
        {
          start_date: duration.start,
          end_date: duration.end || null,
          position: String(formData.get("position") ?? selected?.position ?? ""),
          salary_amount: parseAmount(salaryAmount)!,
          salary_period: salaryPeriod,
          notes: String(formData.get("notes") ?? ""),
        },
        selected?.full_name ?? ""
      );
      toast.success("Contract saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save contract");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New contract"
      description="Draft contract data for an employee. It saves straight to their record."
      size="md"
      position="right"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="contract-form" disabled={saving} loading={saving} variant="outline-brand">
            {saving ? "Saving..." : "Save contract"}
          </Button>
        </div>
      }
    >
      <form id="contract-form" action={handleSubmit} noValidate className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <FormRow label="Employee" required error={errors.employee}>
            <Combobox
              options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
              value={employeeId}
              onChange={handleEmployeeChange}
              placeholder="Search employee..."
              isDisabled={employees.length === 1}
            />
          </FormRow>
          <FormRow label="Position">
            <Input name="position" key={employeeId ?? "none"} defaultValue={selected?.position ?? ""} />
          </FormRow>
          <ContractDurationFields
            value={duration}
            onChange={handleDurationChange}
            errors={{ start: errors.start_date, end: errors.end_date }}
            requireStart
            requireEnd={requireEnd}
          />
          <FormRow label="Salary" required error={errors.salary}>
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
          <FormRow label="Notes">
            <Textarea name="notes" rows={3} />
          </FormRow>
        </div>
      </form>
    </Dialog>
  );
}
