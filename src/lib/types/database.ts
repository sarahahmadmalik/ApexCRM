// Hand-written types matching supabase/migrations/0001_init.sql.
// If you later run `supabase gen types typescript`, that generated file can
// replace this one — the shape below matches it closely on purpose.
//
// Every table/view carries an (empty) `Relationships` array because
// @supabase/postgrest-js's generic query builder requires that field to be
// present to resolve row/insert/update types at all — omitting it makes the
// whole client fall back to `never` for inserts/updates.

export type FirmStatus =
  | "not_started"
  | "in_progress"
  | "sent"
  | "responded"
  | "negotiation"
  | "client";

export type CityManualStatus = "not_started" | "in_progress" | "completed";
export type AngebotStatus = "draft" | "sent" | "accepted" | "rejected";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type ContractStatus = "draft" | "final";
export type EmploymentType = "full_time" | "part_time" | "contract";
export type SalaryPeriod = "month" | "year";

export type JobOpeningStatus = "open" | "paused" | "closed";
export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type LeaveType = "annual" | "sick" | "parental" | "unpaid" | "remote_work";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type TimesheetStatus = "submitted" | "approved";
export type ExpenseCategory = "software" | "travel" | "equipment" | "marketing" | "office" | "other";
export type ExpenseStatus = "pending" | "approved" | "reimbursed" | "rejected";
export type PayrollStatus = "draft" | "processing" | "paid";

export type LineItem = {
  description: string;
  quantity: string; // e.g. "8 Std." or "pauschal" — kept as free text like the templates
  unit_price: number;
  total: number;
};

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          full_name: string;
          /** Company position, free text (e.g. "CTO"). Not an access role. */
          role: string;
          account_role: "admin" | "user";
          workspace_id: string;
          is_active: boolean;
          theme_preference: "light" | "dark" | "system" | null;
          /** Where the AI assistant button shows for this user. Null = header. */
          assistant_placement: "header" | "floating" | "hidden" | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_users"]["Row"]> & {
          id: string;
          full_name: string;
          role: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "app_users_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workspaces"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Row"]>;
        Relationships: [];
      };
      user_permissions: {
        Row: {
          user_id: string;
          page:
            | "dashboard"
            | "firms"
            | "cities"
            | "employees"
            | "contracts"
            | "offers"
            | "invoices"
            | "hiring"
            | "projects"
            | "time_leave"
            | "expenses";
          access: "read" | "write";
        };
        Insert: Database["public"]["Tables"]["user_permissions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_permissions"]["Row"]>;
        Relationships: [];
      };
      firms: {
        Row: {
          id: string;
          name: string;
          country: string;
          state: string;
          city: string;
          status: FirmStatus;
          website: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["firms"]["Row"]> & {
          name: string;
          country: string;
          state: string;
          city: string;
        };
        Update: Partial<Database["public"]["Tables"]["firms"]["Row"]>;
        Relationships: [];
      };
      city_completion: {
        Row: {
          id: string;
          country: string;
          state: string;
          city: string;
          manual_status: CityManualStatus | null;
          note: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["city_completion"]["Row"]> & {
          country: string;
          state: string;
          city: string;
        };
        Update: Partial<Database["public"]["Tables"]["city_completion"]["Row"]>;
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          full_name: string;
          country: string | null;
          position: string | null;
          email: string | null;
          phone: string | null;
          employment_type: EmploymentType;
          contract_start_date: string | null;
          contract_end_date: string | null;
          salary_amount: number | null;
          salary_period: SalaryPeriod | null;
          has_contract: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["employees"]["Row"]> & {
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Row"]>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          employee_id: string;
          status: ContractStatus;
          data: Record<string, unknown>;
          file_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contracts"]["Row"]> & {
          employee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["contracts"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      angebots: {
        Row: {
          id: string;
          angebot_number: string;
          firm_id: string;
          issue_date: string;
          valid_until: string | null;
          line_items: LineItem[];
          vat_rate: number;
          net_amount: number;
          vat_amount: number;
          total_amount: number;
          status: AngebotStatus;
          file_path: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["angebots"]["Row"]> & {
          firm_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["angebots"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "angebots_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      firm_status_history: {
        Row: {
          id: string;
          firm_id: string;
          old_status: FirmStatus | null;
          new_status: FirmStatus;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "firm_status_history_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      dashboard_daily_snapshot: {
        Row: {
          snapshot_date: string;
          total_firms: number;
          sent_count: number;
          responded_count: number;
          negotiation_count: number;
          client_count: number;
          in_progress_count: number;
          cities_completed: number;
          cities_total: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          firm_id: string;
          angebot_id: string | null;
          issue_date: string;
          due_date: string | null;
          service_period_start: string | null;
          service_period_end: string | null;
          line_items: LineItem[];
          vat_rate: number;
          net_amount: number;
          vat_amount: number;
          total_amount: number;
          status: InvoiceStatus;
          file_path: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          firm_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoices_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      job_openings: {
        Row: {
          id: string;
          title: string;
          department: string;
          location: string;
          employment_type: EmploymentType;
          salary_range: string | null;
          status: JobOpeningStatus;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["job_openings"]["Row"]> & {
          title: string;
          department: string;
          location: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_openings"]["Row"]>;
        Relationships: [];
      };
      job_candidates: {
        Row: {
          id: string;
          job_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          stage: CandidateStage;
          rating: number;
          interview_date: string | null;
          portfolio_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["job_candidates"]["Row"]> & {
          job_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_candidates"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "job_candidates_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_openings";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          firm_id: string | null;
          client_name: string | null;
          owner_name: string;
          status: ProjectStatus;
          priority: ProjectPriority;
          budget: number;
          spent: number;
          progress: number;
          start_date: string | null;
          due_date: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          name: string;
          owner_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };
      project_tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          assignee_name: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string | null;
          estimated_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_tasks"]["Row"]> & {
          project_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_tasks"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          id: string;
          employee_name: string;
          leave_type: LeaveType;
          start_date: string;
          end_date: string;
          days_count: number;
          status: LeaveStatus;
          reason: string | null;
          reviewer_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leave_requests"]["Row"]> & {
          employee_name: string;
          leave_type: LeaveType;
          start_date: string;
          end_date: string;
          days_count: number;
        };
        Update: Partial<Database["public"]["Tables"]["leave_requests"]["Row"]>;
        Relationships: [];
      };
      timesheets: {
        Row: {
          id: string;
          employee_name: string;
          project_name: string;
          work_date: string;
          hours_logged: number;
          billable: boolean;
          status: TimesheetStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["timesheets"]["Row"]> & {
          employee_name: string;
          project_name: string;
          work_date: string;
          hours_logged: number;
        };
        Update: Partial<Database["public"]["Tables"]["timesheets"]["Row"]>;
        Relationships: [];
      };
      expense_claims: {
        Row: {
          id: string;
          title: string;
          employee_name: string;
          category: ExpenseCategory;
          amount: number;
          currency: string;
          expense_date: string;
          status: ExpenseStatus;
          receipt_ref: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["expense_claims"]["Row"]> & {
          title: string;
          employee_name: string;
          category: ExpenseCategory;
          amount: number;
          expense_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["expense_claims"]["Row"]>;
        Relationships: [];
      };
      payroll_runs: {
        Row: {
          id: string;
          period_label: string;
          pay_date: string;
          employee_count: number;
          gross_total: number;
          tax_deductions: number;
          net_total: number;
          status: PayrollStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payroll_runs"]["Row"]> & {
          period_label: string;
          pay_date: string;
          employee_count: number;
          gross_total: number;
          tax_deductions: number;
          net_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["payroll_runs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      city_status: {
        Row: {
          country: string;
          state: string;
          city: string;
          firm_count: number;
          status: CityManualStatus;
          is_manual_override: boolean;
          note: string | null;
        };
        Relationships: [];
      };
      firm_status_history_feed: {
        Row: {
          id: string;
          firm_id: string;
          firm_name: string;
          city: string;
          country: string;
          old_status: FirmStatus | null;
          new_status: FirmStatus;
          changed_by: string | null;
          changed_by_name: string | null;
          changed_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
