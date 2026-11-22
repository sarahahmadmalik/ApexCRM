"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateAvatarUrl } from "@/app/(app)/settings/actions";

const AVATAR_EVENT = "apex-avatar-updated";

export function avatarStorageKey(email: string) {
  return `apex-avatar:${(email || "default").toLowerCase()}`;
}

export function useStoredAvatar(email: string) {
  const key = avatarStorageKey(email);
  return useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener(AVATAR_EVENT, handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener(AVATAR_EVENT, handler);
        window.removeEventListener("storage", handler);
      };
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null
  );
}

/** Resizes & center-crops an image file to a crisp 160x160 JPEG data URL. */
async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the selected image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format. Please upload a PNG, JPG, or WebP file."));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas isn't supported in this browser."));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatarCard({
  fullName,
  email,
  role,
  isAdmin,
}: {
  fullName: string;
  email: string;
  role: string;
  isAdmin: boolean;
}) {
  const avatarUrl = useStoredAvatar(email);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP, or GIF).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be smaller than 8 MB.");
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      try {
        localStorage.setItem(avatarStorageKey(email), dataUrl);
        window.dispatchEvent(new Event(AVATAR_EVENT));
      } catch {
        // Ignore quota errors
      }
      await updateAvatarUrl(dataUrl).catch(() => {});
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload profile picture");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      try {
        localStorage.removeItem(avatarStorageKey(email));
        window.dispatchEvent(new Event(AVATAR_EVENT));
      } catch {
        // Ignore storage errors
      }
      await updateAvatarUrl(null).catch(() => {});
      toast.success("Profile picture removed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-4">
        <div className="group relative h-16 w-16 shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-500/30"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-white">
              <User className="h-7 w-7" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            title="Upload profile picture"
            className="absolute -right-1 -bottom-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-navy-900 text-white shadow-md ring-2 ring-white transition-transform hover:scale-105 dark:bg-brand-500 dark:text-navy-950 dark:ring-navy-900"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{fullName}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-500/10 dark:text-brand-300">
              {role}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:bg-white/10 dark:text-slate-300">
              {isAdmin ? "Admin" : "User"} account
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileChange(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-3.5 w-3.5" />
          {avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={handleRemove}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
