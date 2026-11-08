"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Toggle } from "@/components/ui/field";
import { FormError } from "@/components/auth/form-error";
import { PermissionsMatrix } from "@/components/admin/permissions-matrix";
import { createMember, updateMember } from "@/app/(app)/user-management/actions";
import { generatePassword } from "@/lib/password";
import { readOnlyPermissions, type Permissions } from "@/lib/permissions";

export type MemberRow = {
  id: string;
  fullName: string;
  email: string;
  /** Company position (CTO, Designer, ...). */
  role: string;
  accountRole: "admin" | "user";
  isActive: boolean;
  permissions: Permissions;
  createdAt: string;
};

const ROLE_SUGGESTIONS = ["CEO", "CTO", "COO", "CFO", "Project Manager", "Developer", "Designer", "Sales", "Marketing", "HR"];

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy — select and copy it manually.");
  }
}

/** Add-member / edit-member slide-over. Remount (key) on each open so drafts don't linger. */
export function MemberFormDrawer({ open, onClose, member }: { open: boolean; onClose: () => void; member?: MemberRow }) {
  const editing = !!member;
  const [fullName, setFullName] = useState(member?.fullName ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [password, setPassword] = useState(() => (editing ? "" : generatePassword()));
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [permissions, setPermissions] = useState<Permissions>(member?.permissions ?? readOnlyPermissions());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (member) {
        await updateMember(member.id, { fullName, role, isActive, permissions });
        toast.success(`${fullName.trim()} updated`);
        onClose();
      } else {
        await createMember({ fullName, email, role, password, permissions });
        toast.success(`${fullName.trim()} added`);
        setCreated({ email: email.trim().toLowerCase(), password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // After creating: the password is shown once, here, and never retrievable again.
  if (created) {
    const credentials = `Email: ${created.email}\nPassword: ${created.password}`;
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Member added"
        description="Share these sign-in details securely. The password can't be viewed again."
        position="right"
        size="md"
        footer={
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        }
      >
        <dl className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="font-mono-brand mt-0.5 text-sm break-all text-gray-900 dark:text-gray-100">{created.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Temporary password</dt>
            <dd className="font-mono-brand mt-0.5 text-sm break-all text-gray-900 dark:text-gray-100">{created.password}</dd>
          </div>
        </dl>
        <Button variant="outline" className="mt-4 w-full" onClick={() => copy(credentials, "Sign-in details")}>
          <Copy className="h-4 w-4" />
          Copy sign-in details
        </Button>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Ask them to change the password from their Profile page after signing in.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit member" : "Add member"}
      description={editing ? member.email : "Create their account and choose what they can see and do."}
      position="right"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={saving}>
            {editing ? "Save changes" : "Add member"}
          </Button>
        </div>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">Account</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-name">Full name</Label>
              <Input id="m-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80} placeholder="e.g. Anna Schmidt" />
            </div>
            <div>
              <Label htmlFor="m-role">Company position</Label>
              <Input
                id="m-role"
                list="member-role-suggestions"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Project Manager"
                required
                maxLength={60}
              />
              <datalist id="member-role-suggestions">
                {ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <Label htmlFor="m-email">Email</Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={editing}
              disabled={editing}
              maxLength={254}
              placeholder="name@dua-dev.com"
            />
          </div>

          {!editing && (
            <div>
              <Label htmlFor="m-password">Temporary password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="m-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={10}
                    maxLength={72}
                    autoComplete="new-password"
                    className="font-mono-brand pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="icon" title="Generate password" aria-label="Generate password" className="h-10 w-10" onClick={() => setPassword(generatePassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" title="Copy password" aria-label="Copy password" className="h-10 w-10" onClick={() => copy(password, "Password")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                At least 10 characters with letters and numbers. Shown once after you save.
              </p>
            </div>
          )}

          {editing && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/10">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Account active</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isActive ? "Can sign in and use the pages below." : "Can't sign in. Their data and history are kept."}
                </p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">Page access</h3>
          <PermissionsMatrix value={permissions} onChange={setPermissions} />
        </section>

        <FormError id="member-error" message={error} />
      </form>
    </Dialog>
  );
}
