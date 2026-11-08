/**
 * Page-level access model shared by the UI (sidebar, read-only controls), the
 * server (page guards, action guards) and the tests. Deliberately free of
 * imports so it can run anywhere — including plain `node --test`.
 *
 * The user-management area (`/user-management`) is NOT a page in this list on purpose: it can never
 * be granted to a member, only the workspace admin (account_role = 'admin')
 * can open it.
 */

export const PAGES = [
  // The key stays "dashboard" (it is stored in the database); only the label and URL are "Overview".
  { key: "dashboard", label: "Overview", href: "/overview" },
  { key: "firms", label: "Firms / Proposals", href: "/firms" },
  { key: "cities", label: "City Progress", href: "/cities" },
  { key: "employees", label: "Employees", href: "/employees" },
  { key: "contracts", label: "Contracts", href: "/contracts" },
  { key: "offers", label: "Offers", href: "/offers" },
  { key: "invoices", label: "Invoices", href: "/invoices" },
] as const;

export type PageKey = (typeof PAGES)[number]["key"];
export type AccessLevel = "none" | "read" | "write";
export type Permissions = Record<PageKey, AccessLevel>;
export type AccountRole = "admin" | "user";

export const PAGE_KEYS: PageKey[] = PAGES.map((p) => p.key);
export const ACCESS_LEVELS: AccessLevel[] = ["none", "read", "write"];
export const ACCESS_LABELS: Record<AccessLevel, string> = {
  none: "No access",
  read: "Read only",
  write: "Read & write",
};

const RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === "string" && (PAGE_KEYS as string[]).includes(value);
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as string[]).includes(value);
}

function uniform(level: AccessLevel): Permissions {
  return Object.fromEntries(PAGE_KEYS.map((k) => [k, level])) as Permissions;
}

export const noPermissions = (): Permissions => uniform("none");
export const readOnlyPermissions = (): Permissions => uniform("read");
export const fullPermissions = (): Permissions => uniform("write");

/** True when `perms` grants at least `level` on `page`. Level "none" is always satisfied. */
export function hasAccess(perms: Permissions, page: PageKey, level: Exclude<AccessLevel, "none"> = "read") {
  return RANK[perms[page] ?? "none"] >= RANK[level];
}

/**
 * Validates untrusted input (a form / request body) into a full Permissions
 * object. Unknown pages — including "admin" — are rejected rather than
 * ignored, so a crafted request can't smuggle the admin area into a member.
 */
export function parsePermissions(input: unknown): Permissions {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Invalid permissions.");
  }
  const result = noPermissions();
  for (const [page, level] of Object.entries(input)) {
    if (!isPageKey(page)) throw new Error(`Unknown page "${page}".`);
    if (!isAccessLevel(level)) throw new Error(`Invalid access level for "${page}".`);
    result[page] = level;
  }
  return result;
}

/** Rows as stored in user_permissions (absence of a row = no access). */
export function permissionsFromRows(rows: { page: string; access: string }[]): Permissions {
  const result = noPermissions();
  for (const row of rows) {
    if (isPageKey(row.page) && (row.access === "read" || row.access === "write")) result[row.page] = row.access;
  }
  return result;
}

/** Inverse of permissionsFromRows — only pages with actual access are stored. */
export function permissionsToRows(userId: string, perms: Permissions) {
  return PAGE_KEYS.filter((k) => perms[k] !== "none").map((k) => ({
    user_id: userId,
    page: k,
    access: perms[k] as "read" | "write",
  }));
}

/** Effective permissions for an account: admins can do everything on every page. */
export function effectivePermissions(accountRole: AccountRole, stored: Permissions): Permissions {
  return accountRole === "admin" ? fullPermissions() : stored;
}

export function accessiblePages(perms: Permissions) {
  return PAGES.filter((p) => hasAccess(perms, p.key));
}

/** Where to send someone who lands on a page they can't open (or right after login). */
export function firstAccessibleHref(perms: Permissions): string | null {
  return accessiblePages(perms)[0]?.href ?? null;
}

/** Which permission page a pathname belongs to, or null (profile, admin, etc.). */
export function pageForPath(pathname: string): PageKey | null {
  const hit = PAGES.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  return hit?.key ?? null;
}

/** One-line summary for the members table: "All pages · Read & write", "3 pages", "No access". */
export function summarizePermissions(perms: Permissions) {
  const write = PAGE_KEYS.filter((k) => perms[k] === "write").length;
  const read = PAGE_KEYS.filter((k) => perms[k] === "read").length;
  if (write === PAGE_KEYS.length) return "Full access";
  if (read === PAGE_KEYS.length) return "Read only everywhere";
  if (write + read === 0) return "No access";
  const parts: string[] = [];
  if (write) parts.push(`${write} read & write`);
  if (read) parts.push(`${read} read only`);
  return parts.join(" · ");
}
