"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseCsvToObjects } from "@/lib/csv";
import { bulkImportFirms, type BulkImportResult, type BulkImportRow } from "@/app/(app)/firms/actions";
import type { FirmStatus } from "@/lib/types/database";

const VALID_STATUSES: FirmStatus[] = ["not_started", "in_progress", "sent", "responded", "negotiation", "client"];

// Accepts a handful of common column-name spellings so an export from
// another tool (or the PDF-style list this was built for) doesn't need to be
// re-headered by hand first.
const COLUMN_ALIASES: Record<string, keyof BulkImportRow> = {
  name: "name", company: "name", firm: "name", unternehmen: "name",
  country: "country", land: "country",
  state: "state", region: "state", province: "state",
  city: "city", stadt: "city",
  website: "website", url: "website", webseite: "website",
  contact_name: "contact_name", contact: "contact_name",
  contact_email: "contact_email", email: "contact_email", "e-mail": "contact_email", "e-mail-adresse": "contact_email",
  contact_phone: "contact_phone", phone: "contact_phone", telefon: "contact_phone",
  status: "status",
  notes: "notes", note: "notes", industry: "notes", branche: "notes", bemerkungen: "notes",
};

function rowsFromCsv(text: string): { rows: BulkImportRow[]; unmappedColumns: string[] } {
  const objects = parseCsvToObjects(text);
  const unmapped = new Set<string>();
  const rows: BulkImportRow[] = objects.map((obj) => {
    const row: BulkImportRow = { name: "", country: "", city: "" };
    for (const [header, value] of Object.entries(obj)) {
      const key = COLUMN_ALIASES[header];
      if (!key) {
        if (header) unmapped.add(header);
        continue;
      }
      if (key === "status") {
        const norm = value.trim().toLowerCase().replace(/\s+/g, "_");
        if (VALID_STATUSES.includes(norm as FirmStatus)) row.status = norm as FirmStatus;
        continue;
      }
      if (value) row[key] = value;
    }
    // City, Country combined in one cell (as in "Hasselroth, DEU") — split it
    // when a separate country column wasn't supplied or came through empty.
    if (row.city && !row.country && row.city.includes(",")) {
      const [city, country] = row.city.split(",").map((s) => s.trim());
      if (city && country) {
        row.city = city;
        row.country = country;
      }
    }
    return row;
  });
  return { rows, unmappedColumns: Array.from(unmapped) };
}

export function ImportFirmsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? rowsFromCsv(text) : { rows: [], unmappedColumns: [] }), [text]);

  function reset() {
    setText("");
    setResult(null);
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    try {
      const content = await file.text();
      setText(content);
      setResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read the selected CSV file.");
    }
  }

  async function handleImport() {
    if (parsed.rows.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await bulkImportFirms(parsed.rows);
      setResult(outcome);
      if (outcome.inserted > 0) {
        toast.success(`Imported ${outcome.inserted} ${outcome.inserted === 1 ? "firm" : "firms"}`);
      }
      if (outcome.skipped.length === 0) {
        setText("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import firms from CSV"
      description="Paste a spreadsheet export, or upload a .csv file. Columns are matched by name (Name, Country, State, City, Website, Email, Phone, Status, Notes) — State is looked up automatically from City and Country when the column is missing."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {parsed.rows.length > 0
              ? `${parsed.rows.length} ${parsed.rows.length === 1 ? "row" : "rows"} detected`
              : "Paste or upload data to begin"}
          </span>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline-brand"
              onClick={handleImport}
              loading={busy}
              disabled={busy || parsed.rows.length === 0}
            >
              Import {parsed.rows.length > 0 ? parsed.rows.length : ""} firms
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Upload CSV file
          </Button>
          <span className="text-xs text-gray-400 dark:text-gray-500">or paste below</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={"Name,Country,City,Website,Email,Phone,Status,Notes\nGAMMA LOGISTIK GmbH,Germany,Hasselroth,https://www.gamma-logistik.com,info@gamma-logistik.com,,sent,Logistics"}
          rows={10}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-200 bg-white p-3 font-mono text-xs text-gray-900 outline-none transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:bg-navy-800 dark:text-gray-100 dark:focus:border-brand-400 dark:focus:ring-brand-400/10"
        />

        {parsed.unmappedColumns.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Column{parsed.unmappedColumns.length > 1 ? "s" : ""} not recognized and ignored: {parsed.unmappedColumns.join(", ")}
          </p>
        )}

        {result && (
          <div className="rounded-lg border border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-white/10 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {result.inserted} {result.inserted === 1 ? "firm" : "firms"} imported
            </div>
            {result.skipped.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 px-3 pt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {result.skipped.length} row{result.skipped.length > 1 ? "s" : ""} skipped
                </div>
                <ul className="space-y-1 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {result.skipped.map((s) => (
                    <li key={s.row}>
                      Row {s.row} ({s.name}): {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Importing…
          </div>
        )}
      </div>
    </Dialog>
  );
}
