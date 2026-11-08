"use server";

import type { EmploymentType, SalaryPeriod } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";
import { renderDocxTemplate } from "@/lib/documents/generate";
import { renderPdf } from "@/lib/documents/pdf";
import { storeAndSign, slug, type DocumentFormat } from "@/lib/documents/storage";
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatSalary } from "@/lib/utils";
import { validateContractDates, validateSalary } from "@/lib/validation";
import { assertAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

export type EmployeeInput = {
  full_name: string;
  country?: string;
  position?: string;
  email?: string;
  phone?: string;
  employment_type?: EmploymentType;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  salary_amount?: number | null;
  salary_period?: SalaryPeriod | null;
};

export type ContractData = {
  start_date: string;
  end_date?: string | null;
  position: string;
  salary_amount: number;
  salary_period: SalaryPeriod;
  /** Display string, filled in server-side, e.g. "4.500,00 € / month". */
  salary?: string;
  notes?: string;
};

/** Normalises the duration fields and rejects invalid ones before they hit the DB. */
function checkEmployeeInput(input: EmployeeInput, { requireStart = false } = {}): EmployeeInput {
  const normalised = {
    ...input,
    contract_start_date: input.contract_start_date?.trim() || null,
    contract_end_date: input.contract_end_date?.trim() || null,
  };
  const dateErrors = validateContractDates({
    start: normalised.contract_start_date,
    end: normalised.contract_end_date,
    requireStart: requireStart || normalised.employment_type === "contract",
    requireEnd: normalised.employment_type === "contract",
  });
  const message = dateErrors.start ?? dateErrors.end;
  if (message) throw new Error(message);

  if (normalised.salary_amount == null) {
    normalised.salary_amount = null;
    normalised.salary_period = null;
  } else {
    const salaryError = validateSalary(normalised.salary_amount, normalised.salary_period);
    if (salaryError) throw new Error(salaryError);
  }
  return normalised;
}

export async function createEmployee(rawInput: EmployeeInput, contract?: ContractData) {
  await assertAccess("employees", "write");
  if (!rawInput.full_name.trim()) throw new Error("Name is required.");
  // Creating an employee together with a contract also writes to Contracts.
  if (contract) await assertAccess("contracts", "write");
  const input = checkEmployeeInput(rawInput, { requireStart: !!contract });

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/employees");

  if (contract) {
    await createContract(employee.id, contract, input.full_name);
  }

  return employee.id as string;
}

export async function updateEmployee(id: string, rawInput: EmployeeInput) {
  await assertAccess("employees", "write");
  if (!rawInput.full_name.trim()) throw new Error("Name is required.");
  const input = checkEmployeeInput(rawInput);

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
}

export async function deleteEmployee(id: string) {
  await assertAccess("employees", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/employees");
  revalidatePath("/contracts");
}

/**
 * Creates the contract record and — once /templates/contract-template.docx has
 * been added — renders and stores the actual document. Until then this still
 * records the contract's structured data so nothing has to be re-entered.
 */
export async function createContract(employeeId: string, data: ContractData, employeeName: string) {
  await assertAccess("contracts", "write");

  const dateErrors = validateContractDates({ start: data.start_date, end: data.end_date, requireStart: true });
  const dateMessage = dateErrors.start ?? dateErrors.end;
  if (dateMessage) throw new Error(dateMessage);
  const salaryError = validateSalary(data.salary_amount, data.salary_period, { required: true });
  if (salaryError) throw new Error(salaryError);
  data = {
    ...data,
    end_date: data.end_date?.trim() || null,
    salary: formatSalary(data.salary_amount, data.salary_period),
  };

  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({ employee_id: employeeId, data })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // The employee record carries the current contract's duration and salary.
  const { error: datesError } = await supabase
    .from("employees")
    .update({
      contract_start_date: data.start_date,
      contract_end_date: data.end_date ?? null,
      salary_amount: data.salary_amount,
      salary_period: data.salary_period,
    })
    .eq("id", employeeId);
  if (datesError) throw new Error(datesError.message);

  try {
    const buffer = renderDocxTemplate("contract-template.docx", {
      employee_name: employeeName,
      position: data.position,
      start_date: formatDate(data.start_date),
      end_date: data.end_date ? formatDate(data.end_date) : "",
      salary: data.salary,
      notes: data.notes ?? "",
    });

    const filePath = `contracts/${contract.id}.docx`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);

    await supabase.from("contracts").update({ file_path: filePath, status: "final" }).eq("id", contract.id);
  } catch {
    // Template not added yet (or render failed) — the contract's data is
    // still saved, just without a generated file. The UI surfaces this.
  }

  revalidatePath("/employees");
  revalidatePath("/contracts");
  return contract.id as string;
}

type StoredContractData = Partial<ContractData>;

/**
 * Renders a contract as PDF (always available) or Word (needs
 * /templates/contract-template.docx), stores it, and returns a signed URL
 * that downloads it.
 */
export async function downloadContractDocument(id: string, format: DocumentFormat) {
  // The Employees page also offers "View contract", so either page's read access is enough.
  await assertAccess("contracts", "read").catch(() => assertAccess("employees", "read"));

  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, employees(*)")
    .eq("id", id)
    .single();
  if (error || !contract) throw new Error(error?.message ?? "Contract not found");

  const employee = (
    contract as unknown as {
      employees: { full_name: string; country: string | null; email: string | null; employment_type: EmploymentType } | null;
    }
  ).employees;
  const data = (contract.data ?? {}) as StoredContractData;
  const name = employee?.full_name ?? "Employee";
  const salary = data.salary || formatSalary(data.salary_amount, data.salary_period);
  const reference = `CTR-${contract.id.slice(0, 6).toUpperCase()}`;

  let buffer: Buffer;
  if (format === "docx") {
    try {
      buffer = renderDocxTemplate("contract-template.docx", {
        employee_name: name,
        position: data.position ?? "",
        start_date: formatDate(data.start_date),
        end_date: data.end_date ? formatDate(data.end_date) : "",
        salary,
        notes: data.notes ?? "",
      });
    } catch {
      throw new Error("The Word contract template isn't added yet — download the PDF instead.");
    }
  } else {
    buffer = await renderPdf({
      title: "Employment Contract",
      recipient: [name, ...(employee?.email ? [employee.email] : []), ...(employee?.country ? [employee.country] : [])],
      meta: [
        ["Reference", reference],
        ["Issued", formatDate(contract.created_at)],
        ["Status", contract.status === "final" ? "Final" : "Draft"],
      ],
      intro: [
        `This employment contract is made between Dua Dev UG (haftungsbeschränkt) ("the Company") and ${name} ("the Employee").`,
      ],
      sections: [
        {
          heading: "1. Position & employment",
          rows: [
            ["Position", data.position || "—"],
            ["Employment type", employee ? EMPLOYMENT_TYPE_LABELS[employee.employment_type] : "—"],
          ],
        },
        {
          heading: "2. Term",
          rows: [
            ["Start date", formatDate(data.start_date)],
            ["End date", data.end_date ? formatDate(data.end_date) : "Open-ended"],
          ],
        },
        { heading: "3. Remuneration", rows: [["Gross salary", salary]] },
        ...(data.notes?.trim() ? [{ heading: "4. Additional terms", text: data.notes }] : []),
      ],
      signatures: ["For the Company", "Employee"],
    });
  }

  const filePath = `contracts/${contract.id}.${format}`;
  const url = await storeAndSign(supabase, filePath, buffer, format, `Contract-${slug(name)}-${reference}.${format}`);

  if (format === "docx" && contract.file_path !== filePath) {
    await supabase.from("contracts").update({ file_path: filePath, status: "final" }).eq("id", id);
    revalidatePath("/contracts");
    revalidatePath("/employees");
  }
  return url;
}

export async function updateContractStatus(id: string, status: "draft" | "final") {
  await assertAccess("contracts", "write");

  const supabase = await createClient();
  const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
  revalidatePath("/employees");
}
