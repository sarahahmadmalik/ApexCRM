import { getCurrentAppUser } from "@/lib/supabase/server";
import { firstAccessibleHref } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ErrorScene, errorActionClass } from "@/components/ui/error-scene";

export default async function NoAccessPage() {
  const appUser = await getCurrentAppUser();
  const fallback = appUser ? firstAccessibleHref(appUser.permissions) : null;
  // Someone who does have a page shouldn't be parked here.
  if (fallback) redirect(fallback);

  return (
    <ErrorScene
      code="403"
      title="You don't have access to any pages yet"
      message="Your account is active, but no pages have been assigned to it. Ask your workspace admin to grant you access."
    >
      <Link href="/settings" className={errorActionClass}>
        Go to your settings
      </Link>
    </ErrorScene>
  );
}
