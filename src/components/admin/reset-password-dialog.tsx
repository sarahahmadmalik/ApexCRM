"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { FormError } from "@/components/auth/form-error";
import { resetMemberPassword } from "@/app/(app)/user-management/actions";
import { generatePassword } from "@/lib/password";
import type { MemberRow } from "@/components/admin/member-form-drawer";

/** Sets a new password for a member. Remount (key) per open so the generated value is fresh. */
export function ResetPasswordDialog({ member, onClose }: { member: MemberRow | null; onClose: () => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setError("");
    setSaving(true);
    try {
      await resetMemberPassword(member.id, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      size="sm"
      title={done ? "Password updated" : "Reset password"}
      description={member ? `${member.fullName} · ${member.email}` : undefined}
      footer={
        <div className="flex justify-end gap-3">
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="reset-member-form" loading={saving}>
                Set password
              </Button>
            </>
          )}
        </div>
      }
    >
      {done ? (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Share the new password securely. It can&apos;t be viewed again.
          </p>
          <p className="font-mono-brand mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm break-all text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-100">
            {password}
          </p>
          <Button variant="outline" className="mt-3 w-full" onClick={copy}>
            <Copy className="h-4 w-4" />
            Copy password
          </Button>
        </div>
      ) : (
        <form id="reset-member-form" onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <Label htmlFor="reset-pw">New password</Label>
            <div className="flex gap-2">
              <Input
                id="reset-pw"
                placeholder="At least 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                maxLength={72}
                autoComplete="off"
                className="font-mono-brand flex-1"
              />
              <Button type="button" variant="outline" size="icon" title="Generate password" aria-label="Generate password" className="h-10 w-10" onClick={() => setPassword(generatePassword())}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">At least 10 characters with letters and numbers.</p>
          </div>
          <FormError id="reset-member-error" message={error} />
        </form>
      )}
    </Dialog>
  );
}
