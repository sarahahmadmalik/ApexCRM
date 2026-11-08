import type { createClient } from "@/lib/supabase/server";

export type DocumentFormat = "pdf" | "docx";

export const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Stores a generated document in the `documents` bucket and returns a short-
 * lived signed URL that downloads it under a friendly file name (the
 * `download` option sets Content-Disposition, so the browser saves it rather
 * than trying to open it in a popup).
 */
export async function storeAndSign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filePath: string,
  buffer: Buffer,
  format: DocumentFormat,
  downloadName: string
) {
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, buffer, { contentType: CONTENT_TYPES[format], upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 5, { download: downloadName });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** File-name-safe version of a label, e.g. "Nordic Systems AB" → "Nordic-Systems-AB". */
export function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
