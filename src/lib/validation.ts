/** Small shared field validators used by the form dialogs. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateRequired(value: string | null | undefined, label: string) {
  return value && value.trim() ? undefined : `${label} is required`;
}

export function validateEmail(value: string | null | undefined, { required = false } = {}) {
  const v = (value ?? "").trim();
  if (!v) return required ? "Email is required" : undefined;
  return EMAIL_RE.test(v) ? undefined : "Enter a valid email address";
}

export function validateUrl(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  try {
    new URL(v.startsWith("http") ? v : `https://${v}`);
    return undefined;
  } catch {
    return "Enter a valid website URL";
  }
}

export function validatePhone(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  // Deliberately loose: European numbers vary a lot in formatting.
  return /^[+\d][\d\s()./-]{5,}$/.test(v) ? undefined : "Enter a valid phone number";
}

/** Drops undefined entries, so `Object.keys(errors).length` is the error count. */
export function collectErrors(errors: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTRACT_YEARS = 10;

function parseIsoDate(value: string) {
  if (!ISO_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects roll-overs like 2026-02-31 → 2026-03-03.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (y < 1990 || y > 2100) return null;
  return date;
}

/**
 * Validates a contract duration. Returns per-field messages (undefined when a
 * field is fine). Shared by the employee/contract dialogs and the server
 * actions so the rules can't drift apart.
 */
export function validateContractDates({
  start,
  end,
  requireStart = false,
  requireEnd = false,
}: {
  start: string | null | undefined;
  end: string | null | undefined;
  requireStart?: boolean;
  requireEnd?: boolean;
}): { start?: string; end?: string } {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  const errors: { start?: string; end?: string } = {};

  const startDate = s ? parseIsoDate(s) : null;
  const endDate = e ? parseIsoDate(e) : null;

  if (!s) {
    if (requireStart) errors.start = "Start date is required";
    else if (e) errors.start = "Add a start date to go with the end date";
  } else if (!startDate) {
    errors.start = "Enter a valid start date";
  }

  if (!e) {
    if (requireEnd) errors.end = "End date is required for contract roles";
  } else if (!endDate) {
    errors.end = "Enter a valid end date";
  } else if (startDate) {
    if (endDate <= startDate) {
      errors.end = "End date must be after the start date";
    } else {
      const limit = new Date(startDate);
      limit.setFullYear(limit.getFullYear() + MAX_CONTRACT_YEARS);
      if (endDate > limit) errors.end = `Contract can't run longer than ${MAX_CONTRACT_YEARS} years`;
    }
  }

  return errors;
}

const MAX_SALARY = 10_000_000;

/**
 * Parses a money amount typed either way — "55000", "55,000.50" or the German
 * "55.000,50". Returns null when it isn't a plain positive-looking number.
 */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let v = (value ?? "").replace(/[\s€]/g, "");
  if (!v) return null;
  if (!/^\d[\d.,]*$/.test(v)) return null;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Comma is the decimal separator ("55.000,50" or "4500,5").
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    // Dot is the decimal separator, commas group thousands ("55,000.50").
    v = v.replace(/,/g, "");
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(v)) {
    // Dots only, in thousands groups ("55.000").
    v = v.replace(/\./g, "");
  } else if (lastComma !== -1 && /^\d{1,3}(,\d{3})+$/.test(v)) {
    v = v.replace(/,/g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Number(v);
}

export function validateSalary(
  value: string | number | null | undefined,
  period: string | null | undefined,
  { required = false } = {}
) {
  const empty = value == null || String(value).trim() === "";
  if (empty) return required ? "Salary is required" : undefined;
  const amount = parseAmount(value);
  if (amount == null) return "Enter an amount like 4500 or 4.500,00 (max. 2 decimals)";
  if (amount <= 0) return "Salary must be greater than 0";
  if (amount > MAX_SALARY) return "That amount looks too high";
  if (period !== "month" && period !== "year") return "Choose per month or per year";
  if (period === "month" && amount < 100) return "A monthly salary under 100 € looks wrong";
  return undefined;
}
