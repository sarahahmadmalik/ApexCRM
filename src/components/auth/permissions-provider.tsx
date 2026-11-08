"use client";

import { createContext, useContext } from "react";
import { hasAccess, type PageKey, type Permissions } from "@/lib/permissions";

const PermissionsContext = createContext<Permissions | null>(null);

/**
 * Hands the signed-in user's effective page permissions to client components so
 * they can hide controls they can't use. Purely presentational — the server
 * actions and database policies are what actually enforce access.
 */
export function PermissionsProvider({ permissions, children }: { permissions: Permissions; children: React.ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function useCanWrite(page: PageKey) {
  const perms = useContext(PermissionsContext);
  // No provider (shouldn't happen inside the app shell) fails closed.
  return perms ? hasAccess(perms, page, "write") : false;
}
