import { pageForPath, type PageKey } from "@/lib/permissions";

/**
 * What the assistant offers on each page. The Overview (home) and anything without its own context
 * (Settings, ...) gets the generic, whole-business set; every other page gets prompts for that page.
 * A prompt with `fill: true` is put into the input for the user to complete instead of being sent.
 */
export type AssistantPrompt = { title: string; description: string; prompt: string; fill?: boolean; action?: "briefing" };

export type AssistantContext = {
  /** Sent to the server so the assistant knows where the user is. "general" = no specific page. */
  key: PageKey | "general";
  /** Short page name shown in the drawer header. */
  label: string;
  headline: string;
  subline: string;
  prompts: AssistantPrompt[];
};

const GENERAL: AssistantContext = {
  key: "general",
  label: "Workspace",
  headline: "Your whole business, one question away",
  subline: "I can look across firms, offers, invoices, team and city coverage.",
  prompts: [
    { title: "Business briefing", description: "Risks, wins and next steps", prompt: "Give me a business briefing", action: "briefing" },
    { title: "Pipeline summary", description: "Where every firm stands", prompt: "Summarise our firm pipeline by status." },
    { title: "Overdue invoices", description: "Who owes us money", prompt: "Which invoices are overdue, and how much is outstanding?" },
    { title: "Add a firm", description: "I'll prepare it for you", prompt: "Add a firm: ", fill: true },
  ],
};

const BY_PAGE: Partial<Record<PageKey, AssistantContext>> = {
  firms: {
    key: "firms",
    label: "Firms",
    headline: "Work your pipeline faster",
    subline: "Find firms, spot stalled outreach and update statuses by just asking.",
    prompts: [
      { title: "Stalled firms", description: "No update in 14+ days", prompt: "Which firms haven't been updated in the last 14 days while in sent, responded or negotiation?" },
      { title: "In negotiation", description: "Deals closest to closing", prompt: "Show me all firms in negotiation with their cities." },
      { title: "Add a firm", description: "Name, city and country", prompt: "Add a firm: ", fill: true },
      { title: "Change a status", description: "e.g. mark as responded", prompt: "Change the status of ", fill: true },
    ],
  },
  cities: {
    key: "cities",
    label: "City progress",
    headline: "Know your coverage",
    subline: "See where outreach is complete and update a city without opening a form.",
    prompts: [
      { title: "Coverage in Germany", description: "Completed vs in progress", prompt: "How is our city coverage in Germany?" },
      { title: "Cities in progress", description: "Where work is under way", prompt: "Which cities are currently in progress in Germany?" },
      { title: "Mark a city completed", description: "I'll confirm before saving", prompt: "Mark this city as completed: ", fill: true },
      { title: "Compare countries", description: "Progress across markets", prompt: "Compare our city progress across the countries we cover." },
    ],
  },
  employees: {
    key: "employees",
    label: "Employees",
    headline: "Your team, at a glance",
    subline: "Check contracts and roster details, or add someone new.",
    prompts: [
      { title: "Contracts ending soon", description: "Next 60 days", prompt: "Whose contract ends in the next 60 days?" },
      { title: "Team overview", description: "By employment type", prompt: "Give me an overview of the team by employment type." },
      { title: "Add an employee", description: "Name, position, type", prompt: "Add an employee: ", fill: true },
      { title: "Missing contracts", description: "Who has none yet", prompt: "Which employees don't have a contract yet?" },
    ],
  },
  contracts: {
    key: "contracts",
    label: "Contracts",
    headline: "Keep contracts in order",
    subline: "Spot gaps and upcoming expiries across the team.",
    prompts: [
      { title: "Missing contracts", description: "Employees without one", prompt: "Which employees don't have a contract yet?" },
      { title: "Ending soon", description: "Next 60 days", prompt: "Whose contract ends in the next 60 days?" },
      { title: "Team overview", description: "By employment type", prompt: "Give me an overview of the team by employment type." },
      { title: "Add an employee", description: "Start a new contract flow", prompt: "Add an employee: ", fill: true },
    ],
  },
  offers: {
    key: "offers",
    label: "Offers",
    headline: "Close more offers",
    subline: "Chase open offers, draft new ones and update statuses.",
    prompts: [
      { title: "Waiting for an answer", description: "Sent offers, oldest first", prompt: "Which offers are still waiting for an answer, oldest first?" },
      { title: "Draft an offer", description: "Firm, items and prices", prompt: "Draft an offer for ", fill: true },
      { title: "Mark as accepted", description: "I'll confirm before saving", prompt: "Mark the offer for this firm as accepted: ", fill: true },
      { title: "Offer value", description: "Open and accepted totals", prompt: "What is the total value of open and accepted offers?" },
    ],
  },
  invoices: {
    key: "invoices",
    label: "Invoices",
    headline: "Get paid on time",
    subline: "See what is overdue and mark invoices as paid.",
    prompts: [
      { title: "Overdue invoices", description: "Who owes us money", prompt: "Which invoices are overdue, and how much is outstanding?" },
      { title: "Mark as paid", description: "I'll confirm before saving", prompt: "Mark this invoice as paid: ", fill: true },
      { title: "Due this week", description: "Upcoming payments", prompt: "Which invoices are due in the next 7 days?" },
      { title: "Outstanding total", description: "Sent but unpaid", prompt: "What is our total outstanding amount across unpaid invoices?" },
    ],
  },
  hiring: {
    key: "hiring",
    label: "Hiring & ATS",
    headline: "Accelerate your talent pipeline",
    subline: "Review open requisitions, candidate interview stages, and upcoming hiring decisions.",
    prompts: [
      { title: "Business briefing", description: "Risks, wins and next steps", prompt: "Give me a business briefing", action: "briefing" },
      { title: "Team overview", description: "Current roster & roles", prompt: "Give me an overview of the team by employment type." },
      { title: "Onboard new hire", description: "Create employee record", prompt: "Add an employee: ", fill: true },
      { title: "Contracts ending soon", description: "Plan backfill needs", prompt: "Whose contract ends in the next 60 days?" },
    ],
  },
  projects: {
    key: "projects",
    label: "Projects & Tasks",
    headline: "Keep client delivery on track",
    subline: "Monitor project budgets, sprint milestones, and client accounts.",
    prompts: [
      { title: "Business briefing", description: "Overall operational health", prompt: "Give me a business briefing", action: "briefing" },
      { title: "Active clients", description: "Firms with active engagements", prompt: "Show me all client firms and their cities." },
      { title: "Open offers", description: "Upcoming project pipeline", prompt: "Which offers are still waiting for an answer?" },
      { title: "Draft an offer", description: "Scope a new client project", prompt: "Draft an offer for ", fill: true },
    ],
  },
  time_leave: {
    key: "time_leave",
    label: "Time & Leave",
    headline: "Manage team availability & utilization",
    subline: "Stay ahead of PTO schedules, contract renewals, and billable capacity.",
    prompts: [
      { title: "Team roster", description: "Active staff & locations", prompt: "Give me an overview of the team by employment type." },
      { title: "Contracts ending soon", description: "Next 60 days", prompt: "Whose contract ends in the next 60 days?" },
      { title: "Business briefing", description: "Company-wide snapshot", prompt: "Give me a business briefing", action: "briefing" },
      { title: "Add team member", description: "Add to employee roster", prompt: "Add an employee: ", fill: true },
    ],
  },
  expenses: {
    key: "expenses",
    label: "Expenses & Payroll",
    headline: "Financial clarity across operations",
    subline: "Correlate company spend and payroll commitments with invoice cashflow.",
    prompts: [
      { title: "Overdue invoices", description: "Incoming cashflow watch", prompt: "Which invoices are overdue, and how much is outstanding?" },
      { title: "Outstanding total", description: "Unpaid client invoices", prompt: "What is our total outstanding amount across unpaid invoices?" },
      { title: "Salary commitments", description: "Team compensation overview", prompt: "Give me an overview of the team by employment type." },
      { title: "Business briefing", description: "Executive financial summary", prompt: "Give me a business briefing", action: "briefing" },
    ],
  },
};

/** The assistant context for the page the user is on. Overview (home) and unlisted pages are generic. */
export function contextForPath(pathname: string): AssistantContext {
  const page = pageForPath(pathname);
  if (!page || page === "dashboard") return GENERAL;
  return BY_PAGE[page] ?? GENERAL;
}
