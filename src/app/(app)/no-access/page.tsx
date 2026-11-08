import { LockKeyhole } from "lucide-react";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { firstAccessibleHref } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NoAccessPage() {
  const appUser = await getCurrentAppUser();
  const fallback = appUser ? firstAccessibleHref(appUser.permissions) : null;
  // Someone who does have a page shouldn't be parked here.
  if (fallback) redirect(fallback);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">You don&apos;t have access to any pages yet</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Your account is active, but no pages have been assigned to it. Ask your workspace admin to grant you access.
      </p>
      <Link
        href="/profile"
        className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        Go to your profile
      </Link>
    </div>
  );
}
