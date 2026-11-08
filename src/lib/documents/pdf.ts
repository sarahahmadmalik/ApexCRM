import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Branded PDF rendering for offers, invoices and contracts.
 *
 * The .docx files come from Word templates; PDFs are drawn directly from the
 * same data with pdf-lib (pure JS — no LibreOffice/Word needed on the server),
 * so PDF download works even where a Word template hasn't been added yet.
 */

export type PdfItem = { pos: number; description: string; quantity: string; unit_price: string; total: string };

export type PdfSpec = {
  /** Big document name, e.g. "Angebot", "Rechnung", "Employment Contract". */
  title: string;
  /** Recipient address block (first line is bolded). */
  recipient?: string[];
  /** Label/value pairs shown top-right (number, dates, …). */
  meta: [string, string][];
  /** Paragraphs before the body. */
  intro?: string[];
  items?: { labels: [string, string, string, string, string]; rows: PdfItem[] };
  totals?: { label: string; value: string; strong?: boolean }[];
  /** Key/value blocks and free text — used by contracts. */
  sections?: { heading: string; rows?: [string, string][]; text?: string }[];
  /** Paragraphs after the body (closing, signature…). */
  closing?: string[];
  signatures?: [string, string];
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const BRAND = rgb(0.055, 0.455, 0.565); // brand-700 #0e7490
const INK = rgb(0.059, 0.09, 0.165); // navy-900
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.886, 0.91, 0.941);
const ZEBRA = rgb(0.972, 0.98, 0.988);

const COMPANY = "Dua Dev UG (haftungsbeschränkt)";
const FOOTER = "Dua Dev UG (haftungsbeschränkt) · dua-dev.com";

// WinAnsi (what the built-in Helvetica can encode) = Latin-1 + these extras.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function safe(text: string) {
  return Array.from(text ?? "")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === "\n" || ch === "\t") return " ";
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      if (ch === "→") return "->";
      return "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderPdf(spec: PdfSpec): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(spec.title);
  pdf.setCreator(COMPANY);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = A4[0] - MARGIN * 2;
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const text = (value: string, x: number, atY: number, size = 10, font = regular, color = INK) =>
    page.drawText(safe(value), { x, y: atY, size, font, color });

  const rightText = (value: string, right: number, atY: number, size = 10, font = regular, color = INK) =>
    text(value, right - font.widthOfTextAtSize(safe(value), size), atY, size, font, color);

  function drawChrome() {
    page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: BRAND });
    page.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: A4[0] - MARGIN, y: 40 }, thickness: 0.5, color: RULE });
    text(FOOTER, MARGIN, 27, 8, regular, MUTED);
  }

  function newPage() {
    page = pdf.addPage(A4);
    drawChrome();
    y = A4[1] - MARGIN;
  }

  function ensure(space: number) {
    if (y - space < 60) newPage();
  }

  drawChrome();

  // Letterhead
  text("Dua Dev", MARGIN, y - 4, 20, bold, INK);
  text(COMPANY, MARGIN, y - 20, 8.5, regular, MUTED);
  rightText(spec.title.toUpperCase(), A4[0] - MARGIN, y - 4, 18, bold, BRAND);
  y -= 50;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1, color: RULE });
  y -= 24;

  // Recipient (left) + meta (right)
  const blockTop = y;
  (spec.recipient ?? []).forEach((line, i) => {
    text(line, MARGIN, y - i * 14, i === 0 ? 11 : 10, i === 0 ? bold : regular);
  });
  const metaX = MARGIN + width * 0.58;
  spec.meta.forEach(([label, value], i) => {
    text(label, metaX, blockTop - i * 15, 9, regular, MUTED);
    rightText(value, A4[0] - MARGIN, blockTop - i * 15, 9.5, bold);
  });
  y = blockTop - Math.max((spec.recipient?.length ?? 0) * 14, spec.meta.length * 15) - 20;

  for (const paragraph of spec.intro ?? []) {
    for (const line of wrap(paragraph, regular, 10, width)) {
      ensure(14);
      text(line, MARGIN, y);
      y -= 14;
    }
    y -= 6;
  }

  // Line items
  if (spec.items && spec.items.rows.length > 0) {
    const cols = [MARGIN + 6, MARGIN + 36, MARGIN + width * 0.62, MARGIN + width * 0.8, A4[0] - MARGIN - 6];
    const header = () => {
      page.drawRectangle({ x: MARGIN, y: y - 8, width, height: 22, color: INK });
      const [pos, desc, qty, unit, total] = spec.items!.labels;
      text(pos, cols[0], y, 8.5, bold, rgb(1, 1, 1));
      text(desc, cols[1], y, 8.5, bold, rgb(1, 1, 1));
      text(qty, cols[2], y, 8.5, bold, rgb(1, 1, 1));
      rightText(unit, cols[4] - width * 0.14, y, 8.5, bold, rgb(1, 1, 1));
      rightText(total, cols[4], y, 8.5, bold, rgb(1, 1, 1));
      y -= 26;
    };
    ensure(60);
    header();
    spec.items.rows.forEach((row, i) => {
      const descLines = wrap(row.description, regular, 9.5, cols[2] - cols[1] - 10);
      const rowHeight = Math.max(1, descLines.length) * 13 + 8;
      if (y - rowHeight < 60) {
        newPage();
        header();
      }
      if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowHeight + 12, width, height: rowHeight, color: ZEBRA });
      text(String(row.pos), cols[0], y, 9.5, regular, MUTED);
      descLines.forEach((line, li) => text(line, cols[1], y - li * 13, 9.5));
      text(row.quantity, cols[2], y, 9.5);
      rightText(row.unit_price, cols[4] - width * 0.14, y, 9.5);
      rightText(row.total, cols[4], y, 9.5, bold);
      y -= rowHeight;
    });
    y -= 6;
  }

  // Totals
  if (spec.totals?.length) {
    ensure(spec.totals.length * 18 + 10);
    const left = MARGIN + width * 0.55;
    page.drawLine({ start: { x: left, y: y + 6 }, end: { x: A4[0] - MARGIN, y: y + 6 }, thickness: 0.5, color: RULE });
    y -= 10;
    for (const row of spec.totals) {
      if (row.strong) {
        page.drawRectangle({ x: left, y: y - 7, width: A4[0] - MARGIN - left, height: 22, color: ZEBRA });
      }
      text(row.label, left + 6, y, row.strong ? 10.5 : 9.5, row.strong ? bold : regular, row.strong ? INK : MUTED);
      rightText(row.value, A4[0] - MARGIN - 6, y, row.strong ? 11 : 9.5, bold, row.strong ? BRAND : INK);
      y -= 20;
    }
    y -= 10;
  }

  // Sections (contracts)
  for (const section of spec.sections ?? []) {
    ensure(40);
    text(section.heading, MARGIN, y, 11, bold, BRAND);
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 16;
    for (const [label, value] of section.rows ?? []) {
      const lines = wrap(value || "—", bold, 10, width * 0.62);
      ensure(lines.length * 14 + 4);
      text(label, MARGIN, y, 9.5, regular, MUTED);
      lines.forEach((line, i) => text(line, MARGIN + width * 0.36, y - i * 14, 10, bold));
      y -= lines.length * 14 + 6;
    }
    if (section.text) {
      for (const line of wrap(section.text, regular, 10, width)) {
        ensure(14);
        text(line, MARGIN, y);
        y -= 14;
      }
    }
    y -= 14;
  }

  for (const paragraph of spec.closing ?? []) {
    for (const line of wrap(paragraph, regular, 10, width)) {
      ensure(14);
      text(line, MARGIN, y);
      y -= 14;
    }
    y -= 6;
  }

  if (spec.signatures) {
    ensure(80);
    y -= 40;
    const half = (width - 40) / 2;
    spec.signatures.forEach((label, i) => {
      const x = MARGIN + i * (half + 40);
      page.drawLine({ start: { x, y }, end: { x: x + half, y }, thickness: 0.75, color: MUTED });
      text(label, x, y - 14, 9, regular, MUTED);
    });
  }

  return Buffer.from(await pdf.save());
}
