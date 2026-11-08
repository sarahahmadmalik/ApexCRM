"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/field";
import { collectErrors, validateRequired } from "@/lib/validation";
import { changePassword } from "@/app/(app)/settings/actions";

export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = collectErrors({
      current: validateRequired(current, "Current password"),
      next: next.length >= 10 ? undefined : "New password must be at least 10 characters",
      confirm: confirm === next ? undefined : "Passwords don't match",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Security" description="Change the password you use to sign in to this tool." />
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormRow label="Current password" required error={errors.current}>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label="New password" required error={errors.next}>
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 10 characters, letters and numbers" />
        </FormRow>
        <FormRow label="Confirm new password" required error={errors.confirm}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </FormRow>
        <div className="sm:col-span-2">
          <Button type="submit" variant="outline-brand" disabled={saving} loading={saving}>
            <KeyRound className="h-4 w-4" />
            {saving ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
