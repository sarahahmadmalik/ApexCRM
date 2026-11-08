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
};

/** The assistant context for the page the user is on. Overview (home) and unlisted pages are generic. */
export function contextForPath(pathname: string): AssistantContext {
  const page = pageForPath(pathname);
  if (!page || page === "dashboard") return GENERAL;
  return BY_PAGE[page] ?? GENERAL;
}
