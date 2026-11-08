import { InlineFilterTableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <InlineFilterTableSkeleton stats={4} actions={1} filterCols={1} rows={8} />;
}
