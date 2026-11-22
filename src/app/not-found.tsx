import Link from "next/link";
import type { Metadata } from "next";
import { BackButton } from "@/components/ui/back-button";
import { ErrorScene, errorActionClass } from "@/components/ui/error-scene";

export const metadata: Metadata = { title: "Page not found · ApexCRM" };

/**
 * The 404 page: for unknown URLs and for pages a user isn't allowed to know exist (User Management
 * for non-admins). Follows light / dark like every other page, inside the app shell or on its own.
 */
export default function NotFound() {
  return (
    <ErrorScene
      code="404"
      title="Page not found"
      message="The page you're looking for doesn't exist, was moved, or isn't available to your account."
    >
      <BackButton />
      <Link href="/overview" className={errorActionClass}>
        Go to Overview
      </Link>
    </ErrorScene>
  );
}
