import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-skeleton rounded-md bg-gray-200 dark:bg-white/10", className)} />;
}

/** Card surface used by every skeleton block, matching the real Card component. */
function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-navy-900",
        className
      )}
    >
      {children}
    </div>
  );
}

function HeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-36" />
        ))}
      </div>
    </div>
  );
}

function TableRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="min-h-[420px] divide-y divide-gray-100 dark:divide-white/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Generic page placeholder: header + optional stat cards + filters + table. */
export function PageSkeleton({
  stats = 0,
  rows = 6,
  filters = true,
  actions = 1,
}: {
  stats?: number;
  rows?: number;
  filters?: boolean;
  actions?: number;
}) {
  return (
    <div>
      <HeaderSkeleton actions={actions} />

      {stats > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {filters && <Skeleton className="mb-4 h-[74px] w-full rounded-xl" />}

      <SkeletonCard className="overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
          <Skeleton className="h-3 w-40" />
        </div>
        <TableRowsSkeleton rows={rows} />
      </SkeletonCard>
    </div>
  );
}

/**
 * Table pages whose filters sit flush inside the table card's own header
 * (Firms, Offers, Invoices, Contracts) rather than as a separate bar above
 * it — matches that layout exactly, stat cards optional.
 */
export function InlineFilterTableSkeleton({
  stats = 0,
  actions = 2,
  filterCols = 4,
  rows = 8,
}: {
  stats?: number;
  actions?: number;
  filterCols?: number;
  rows?: number;
}) {
  return (
    <div>
      <HeaderSkeleton actions={actions} />

      {stats > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
          ))}
        </div>
      )}

      <SkeletonCard className="overflow-hidden">
        {/* Filter row — flush inside the card, like the real one */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-white/10">
          <Skeleton className="h-10 w-full lg:w-64" />
          <div className="hidden flex-1 gap-3 lg:grid" style={{ gridTemplateColumns: `repeat(${filterCols}, minmax(0, 1fr))` }}>
            {Array.from({ length: filterCols }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
          <Skeleton className="h-3 w-40" />
        </div>
        <TableRowsSkeleton rows={rows} />

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-9 rounded-lg" />
            ))}
          </div>
        </div>
      </SkeletonCard>
    </div>
  );
}

/** Firms: filters live flush inside the table card, then rows, then pagination. */
export function FirmsSkeleton() {
  return <InlineFilterTableSkeleton actions={2} filterCols={4} rows={8} />;
}

/** Employees: KPI strip, filter bar, then the actual card grid (not table rows). */
export function EmployeesSkeleton() {
  return (
    <div>
      <HeaderSkeleton actions={1} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="mb-4 h-[74px] w-full rounded-xl" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Dashboard: KPI strip, map card with its right-hand peek panel, then the two feed cards. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton actions={0} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
        ))}
      </div>

      {/* Map card: map area on the left, peek panel on the right */}
      <SkeletonCard className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 lg:border-r lg:border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-white/10">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
            <div className="flex items-center justify-center p-4 sm:p-5">
              <Skeleton className="h-[420px] w-full max-w-2xl rounded-xl" />
            </div>
          </div>

          {/* Right-hand peek panel */}
          <div className="w-full shrink-0 border-t border-gray-100 p-4 sm:p-5 lg:w-80 lg:border-t-0 dark:border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-5 h-3 w-28" />
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-4 h-10 w-full rounded-lg" />
          </div>
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkeletonCard className="overflow-hidden lg:col-span-2">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/10">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <TableRowsSkeleton rows={6} />
        </SkeletonCard>

        <SkeletonCard className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/10">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-60 max-w-full" />
          </div>
          <div className="space-y-5 px-5 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}

/** Cities: country tabs, 3 stat cards, filter bar, city card grid, audit table. */
export function CitiesSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <HeaderSkeleton actions={0} />

      <Skeleton className="mb-6 h-12 w-full max-w-2xl rounded-xl" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="mb-4 h-[74px] w-full rounded-xl" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
        ))}
      </div>

      <SkeletonCard className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/10">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <TableRowsSkeleton rows={6} />
      </SkeletonCard>
    </div>
  );
}

/** Profile: account card, employment card, appearance and password cards. */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <SkeletonCard className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-4 p-5">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </SkeletonCard>

      <SkeletonCard className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
