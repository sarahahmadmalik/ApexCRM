"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/auth/guards";
import type { ExpenseCategory, ExpenseStatus, PayrollStatus } from "@/lib/types/database";

export type ExpenseClaimInput = {
  title: string;
  employee_name: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  receipt_ref?: string;
  notes?: string;
};

export type PayrollRunInput = {
  period_label: string;
  pay_date: string;
  employee_count: number;
  gross_total: number;
  tax_deductions: number;
  notes?: string;
};

export async function createExpenseClaim(input: ExpenseClaimInput) {
  await assertAccess("expenses", "write");
  if (!input.title.trim()) throw new Error("Expense description is required.");
  if (!input.employee_name.trim()) throw new Error("Employee name is required.");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const supabase = await createClient();
  const { error } = await supabase.from("expense_claims").insert({
    title: input.title.trim(),
    employee_name: input.employee_name.trim(),
    category: input.category,
    amount: input.amount,
    currency: "EUR",
    expense_date: input.expense_date,
    status: "pending",
    receipt_ref: input.receipt_ref?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function updateExpenseStatus(id: string, status: ExpenseStatus) {
  await assertAccess("expenses", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("expense_claims").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function deleteExpenseClaim(id: string) {
  await assertAccess("expenses", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("expense_claims").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function createPayrollRun(input: PayrollRunInput) {
  await assertAccess("expenses", "write");
  if (!input.period_label.trim()) throw new Error("Payroll period is required.");
  if (!input.pay_date) throw new Error("Pay date is required.");
  if (input.gross_total <= 0) throw new Error("Gross total must be greater than zero.");

  const net_total = Math.max(0, input.gross_total - input.tax_deductions);
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_runs").insert({
    period_label: input.period_label.trim(),
    pay_date: input.pay_date,
    employee_count: Math.max(1, input.employee_count || 1),
    gross_total: input.gross_total,
    tax_deductions: Math.max(0, input.tax_deductions || 0),
    net_total,
    status: "draft",
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function updatePayrollStatus(id: string, status: PayrollStatus) {
  await assertAccess("expenses", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_runs").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function deletePayrollRun(id: string) {
  await assertAccess("expenses", "write");
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_runs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}
