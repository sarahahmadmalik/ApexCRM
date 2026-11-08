"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { TableEmptyState, TableHead, TableShell } from "@/components/ui/table-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MemberFormDrawer, type MemberRow } from "@/components/admin/member-form-drawer";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { deleteMember, renameWorkspace } from "@/app/(app)/user-management/actions";
import { avatarTint, cn, formatDate } from "@/lib/utils";
import { summarizePermissions } from "@/lib/permissions";

function WorkspaceCard({ name, memberCount }: { name: string; memberCount: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await renameWorkspace(value);
      toast.success("Workspace renamed");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename the workspace");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title="Workspace" description="Your team's space in this tool. Members you add belong to it." />
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        {editing ? (
          <form onSubmit={save} className="flex w-full max-w-md items-center gap-2">
            <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} required autoFocus aria-label="Workspace name" />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" loading={saving} aria-label="Save name">
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                setValue(name);
                setEditing(false);
              }}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {memberCount} {memberCount === 1 ? "member" : "members"} · Default workspace
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Rename workspace"
              aria-label="Rename workspace"
              className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AdminPanel({
  workspaceName,
  members,
  currentUserId,
}: {
  workspaceName: string;
  members: MemberRow[];
  currentUserId: string;
}) {
  // `null` = closed, "new" = add form, otherwise the member being edited.
  const [drawer, setDrawer] = useState<"new" | MemberRow | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [resetting, setResetting] = useState<MemberRow | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function openDrawer(target: "new" | MemberRow) {
    setDrawerKey((k) => k + 1); // fresh form state each time
    setDrawer(target);
  }

  async function handleDelete(member: MemberRow) {
    setBusyId(member.id);
    try {
      await deleteMember(member.id);
      toast.success(`${member.fullName} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the member");
    } finally {
      setBusyId(null);
    }
  }

  const iconButton =
    "cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200";

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Add people to your workspace and choose exactly which pages each one can see and change."
        actions={
          <Button variant="outline-fill" onClick={() => openDrawer("new")}>
            <Plus className="h-4 w-4" />
            Add member
          </Button>
        }
      />

      <WorkspaceCard name={workspaceName} memberCount={members.length} />

      <TableShell>
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <TableHead
            columns={[
              { label: "Member", width: "w-[27%]" },
              { label: "Company role", width: "w-[16%]" },
              { label: "Account role", width: "w-[13%]" },
              { label: "Page access", width: "w-[20%]" },
              { label: "Status", width: "w-[10%]" },
              { label: "Actions", align: "right", width: "w-[14%]" },
            ]}
          />
          <tbody className="divide-y divide-gray-100 dark:divide-white/10">
            {members.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                icon={UserRound}
                title="No members yet"
                description="Add your first team member to give them access."
              />
            ) : (
              members.map((m, index) => {
                const isAdmin = m.accountRole === "admin";
                const isSelf = m.id === currentUserId;
                return (
                  <tr key={m.id} className="h-14 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset",
                            avatarTint(index)
                          )}
                        >
                          {m.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                            {m.fullName}
                            {isSelf && <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-gray-400 dark:text-gray-500" title={m.email}>
                            {m.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate text-gray-700 dark:text-gray-300" title={m.role}>
                        {m.role}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Since {formatDate(m.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          isAdmin
                            ? "gap-1 bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20"
                            : "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20"
                        }
                      >
                        {isAdmin && <ShieldCheck className="h-3 w-3" />}
                        {isAdmin ? "Admin" : "User"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <span className="block truncate">{isAdmin ? "Full access + user management" : summarizePermissions(m.permissions)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          m.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20"
                            : "bg-gray-100 text-gray-500 ring-gray-400/20 dark:bg-white/5 dark:text-gray-400"
                        }
                      >
                        {m.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <p className="text-right text-xs text-gray-400 dark:text-gray-500">Workspace owner</p>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className={iconButton}
                            title="Edit member & access"
                            aria-label={`Edit ${m.fullName}`}
                            onClick={() => openDrawer(m)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={iconButton}
                            title="Reset password"
                            aria-label={`Reset password for ${m.fullName}`}
                            onClick={() => {
                              setResetKey((k) => k + 1);
                              setResetting(m);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            title="Remove member"
                            aria-label={`Remove ${m.fullName}`}
                            className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            onClick={() =>
                              confirm({
                                title: "Remove member",
                                confirmLabel: "Remove",
                                message: (
                                  <>
                                    <strong className="font-semibold text-gray-900 dark:text-gray-100">{m.fullName}</strong>{" "}
                                    will lose access and their login will be deleted. Records they created are kept. This
                                    can&apos;t be undone. To keep the account but block sign-in, disable it instead.
                                  </>
                                ),
                                onConfirm: () => handleDelete(m),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {confirmDialog}

      {drawer && (
        <MemberFormDrawer
          key={drawerKey}
          open
          onClose={() => setDrawer(null)}
          member={drawer === "new" ? undefined : drawer}
        />
      )}
      <ResetPasswordDialog key={resetKey} member={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}
