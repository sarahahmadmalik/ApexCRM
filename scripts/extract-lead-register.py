"""
Extracts the "Geschaeftsentwicklung & Lead-Tracking-Register" PDF (the full outreach register) to JSON.

    python scripts/extract-lead-register.py "Dua Dev UG-FirmContactList_DE_11092026.pdf" supabase/data/lead-register.json

Needs PyMuPDF (pip install pymupdf). Pages are processed in parallel.

The table layout is not the same on every page (some pages have an extra empty column, a row can be split
across a page break, S.No is written "1.", "13-" or "1048"), so fields are located by what they contain,
not by their column number:
  e-mail   = the cell with "@"            website = the cell starting with http / www
  location = the cell that names a country, industry = the cell after the website, date = dd.mm.yyyy
The status is a coloured square; its fill colour is matched to the legend printed on page 1.
"""
import json
import multiprocessing as mp
import re
import sys

import pymupdf

SOFT_HYPHEN = "­"
NL = chr(10)

# Legend on page 1 (left to right) -> what it means. Colours are the square fill (r, g, b).
LEGEND = {
    "#00b0f0": "email_sent",
    "#ffc000": "awaiting_reply",
    "#00b050": "reply_received",
    "#f54a45": "follow_up_needed",
    "#7030a0": "appointment_made",
    "#9dfaa6": "business_opportunity",
    "#ff0000": "no_interest",
}

COUNTRY_RE = re.compile(r"\b(DEU|DUE|Deutschland|Austria|Asutria|Austra?ia|Finn?land|Finalnd|Filand|Holland|Netherlands|Sweden|Belgium|Belgien)\b", re.I)


def clean(text):
    if text is None:
        return ""
    return re.sub(r"\s+", " ", text.replace(SOFT_HYPHEN, "")).strip()


def joined(text):
    return re.sub(r"\s+", "", (text or "").replace(SOFT_HYPHEN, ""))


def wrapped(text, join_lowercase=True):
    """Undo PDF line wrapping: mid-word breaks join, hyphen breaks drop the hyphen, others become a space."""
    lines = [l.strip() for l in (text or "").replace(SOFT_HYPHEN, "").split(NL) if l.strip()]
    out = ""
    for line in lines:
        if not out:
            out = line
        elif out.endswith("-") and line[:1].islower():
            out = out[:-1] + line
        elif join_lowercase and line[:1].islower() and out[-1].isalpha() and len(out.split(" ")[-1]) >= 7:
            out += line
        else:
            out += " " + line
    return re.sub(r"\s+", " ", out).strip()


def parse_emails(cell):
    """Several addresses can share a cell; each line with an @ starts a new one (a line starting with @ continues)."""
    emails = []
    for line in (cell or "").replace(SOFT_HYPHEN, "").split(NL):
        line = line.strip()
        if not line:
            continue
        if emails and not (("@" in line and "@" in emails[-1]) and not line.startswith("@")):
            emails[-1] += line
        else:
            emails.append(line)
    out = []
    for e in (re.sub(r"\s+", "", e) for e in emails):
        if re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", e) and e.lower() not in [x.lower() for x in out]:
            out.append(e)
    return out



def emails_from_lines(lines):
    """
    Rebuild wrapped e-mail addresses from the text lines of one row's e-mail column.
    A line with "@" is an address (its local part may sit on the previous line: after a hyphen, or when the
    line starts with "@"); following lines belong to it until the domain has a full ending.
    """
    lines = [l.strip() for l in lines if l.strip()]
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "@" not in line:
            i += 1
            continue
        email = line
        if line.startswith("@") and i > 0 and "@" not in lines[i - 1]:
            email = lines[i - 1] + line
        elif i > 0 and "@" not in lines[i - 1] and lines[i - 1].endswith("-") and " " not in lines[i - 1]:
            email = lines[i - 1] + line
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            complete = re.search(r"@[^@\s]+\.[A-Za-z]{2,}\.?$", email) and not email.rstrip(".").endswith("-")
            if "@" in nxt or " " in nxt or "," in nxt or nxt.lower().startswith("http") or complete:
                break
            email += nxt
            j += 1
        # a following line that starts with "@" belongs to the NEXT address (its local part is this line's tail)
        out.append(email.rstrip(".;,"))
        i = j
    seen, res = set(), []
    for e in out:
        e = re.sub(r"\s+", "", e)
        if re.fullmatch(r"[^@\s]+@[^@\s]+", e) and e.lower() not in seen:
            seen.add(e.lower())
            res.append(e)
    return res


def repair_with_website(email, website):
    """The PDF text sometimes drops the last letter of an address ('...asuntopehtoori.f'); the firm's website host
    tells us the real ending."""
    m = re.match(r"https?://(?:www\.)?([^/]+)", website or "", re.I)
    if not m or "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    host = m.group(1).lower()
    d = domain.lower()
    if d != host and host.startswith(d) and (0 < len(host) - len(d) <= 3 or "." not in d):
        return local + "@" + host
    return email


def sanitize_website(url):
    url = re.sub(r"[?&]utm.*$", "", url, flags=re.I).strip()
    if not url or "google.com/maps" in url.lower():
        return ""
    if not re.match(r"https?://", url, re.I):
        url = "https://" + url
    m = re.match(r"(https?://[^/]+)(/.*)?$", url, flags=re.I)
    if m and m.group(2) and (m.group(2).endswith("_") or " " in m.group(2)):
        return m.group(1) + "/"
    return url


def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in rgb)


def parse_page(args):
    pdf_path, page_no = args
    doc = pymupdf.open(pdf_path)
    page = doc[page_no - 1]
    squares = []
    for d in page.get_drawings():
        r, fill = d["rect"], d.get("fill")
        if fill and 5 < r.width < 25 and 5 < r.height < 25 and hex_of(fill) in LEGEND and r.x0 > 500:
            squares.append((r, hex_of(fill)))
    rows = []
    for table in page.find_tables().tables:
        extracted = table.extract()
        # first pass: which column holds the e-mail on this table (pages differ by one blank column)
        email_cols = [next((i for i, c in enumerate(r) if c and "@" in c), None) for r in extracted]
        email_cols = [c for c in email_cols if c is not None]
        table_email_col = max(set(email_cols), key=email_cols.count) if email_cols else 2

        logical = []  # each: {"cells": [...], "rows": [row objects]} — an S.No row plus its continuation lines
        for row, raw in zip(table.rows, extracted):
            cells = [c or "" for c in raw]
            first = clean(cells[0])
            if first in ("S.No", "Stautus:") or first.startswith("Stautus"):
                continue
            m = re.fullmatch(r"(\d{1,5})\s*[.\-]?", first)
            if not any(cells[1:]) and not m:
                continue
            if m or not logical:
                logical.append({"sno": int(m.group(1)) if m else None, "cells": [cells], "rows": [row]})
            else:
                logical[-1]["cells"].append(cells)
                logical[-1]["rows"].append(row)

        for idx, lg in enumerate(logical):
            cells = lg["cells"][0]
            x0 = min(r.bbox[0] for r in lg["rows"])
            y0 = min(r.bbox[1] for r in lg["rows"])
            x1 = max(r.bbox[2] for r in lg["rows"])
            y1 = max(r.bbox[3] for r in lg["rows"])
            color = next((c for r, c in squares if y0 - 1 <= (r.y0 + r.y1) / 2 <= y1 + 1), None)
            # every text cell of the logical row, joined (company / industry / remarks continue on later lines)
            width = max(len(c) for c in lg["cells"])
            merged = [NL.join(c[i] for c in lg["cells"] if i < len(c) and c[i]) for i in range(width)]
            cells = merged

            # e-mails: read the e-mail column's text by coordinates, line by line
            cell_boxes = [b for b in lg["rows"][0].cells]
            ecol = table_email_col if table_email_col < len(cell_boxes) else 2
            box = cell_boxes[ecol] if ecol < len(cell_boxes) and cell_boxes[ecol] else None
            emails = []
            if box:
                words = page.get_text("words", clip=pymupdf.Rect(box[0] - 1, y0 - 1, box[2] + 1, y1 + 1))
                lines = {}
                for w in words:
                    lines.setdefault(round(w[1] / 2), []).append((w[0], w[4]))
                text_lines = [" ".join(t for _, t in sorted(v)) for _, v in sorted(lines.items())]
                emails = emails_from_lines(text_lines)
            if not emails:
                emails = parse_emails(cells[next((i for i, c in enumerate(cells) if "@" in c), ecol)] if any("@" in c for c in cells) else "")

            web_i = next((i for i, c in enumerate(cells) if re.search(r"(https?:|www\.)", c.strip(), re.I)), None)
            email_i = next((i for i, c in enumerate(cells) if "@" in c), None)
            loc_i = next((i for i, c in enumerate(cells) if i > (email_i if email_i is not None else 2) and "@" not in c and "http" not in c.lower() and COUNTRY_RE.search(c)), None)
            date_i = next((i for i, c in enumerate(cells) if re.search(r"\d{2}\.\d{2}\.\d{4}", c)), None)
            industry_i = web_i + 1 if web_i is not None and web_i + 1 < len(cells) else None
            if industry_i is not None and industry_i == date_i:
                industry_i = None
            website = sanitize_website(joined(cells[web_i])) if web_i is not None else ""
            company_src = next((c for c in cells[1 : (ecol if ecol else 3)] if c.strip()), "")

            rows.append(
                {
                    "sno": lg["sno"],
                    "page": page_no,
                    "company": wrapped(company_src, join_lowercase=False),
                    "emails": [repair_with_website(e, website) for e in emails],
                    "location": clean(cells[loc_i]) if loc_i is not None else "",
                    "website": website,
                    "industry": wrapped(cells[industry_i]) if industry_i is not None else "",
                    "sent_dates": re.findall(r"\d{2}\.\d{2}\.\d{4}", cells[date_i]) if date_i is not None else [],
                    "status_color": color,
                    "status": LEGEND.get(color or "", None),
                    "next_action": wrapped(cells[-2]) if len(cells) > 3 else "",
                    "remarks": wrapped(cells[-1]) if len(cells) > 3 else "",
                    "continuation": lg["sno"] is None,
                }
            )
    return rows


def main(pdf_path, out_path):
    doc = pymupdf.open(pdf_path)
    n = len(doc)
    doc.close()
    with mp.Pool(min(8, mp.cpu_count())) as pool:
        pages = pool.map(parse_page, [(pdf_path, p) for p in range(1, n + 1)], chunksize=4)

    rows = []
    for page_rows in pages:
        for r in page_rows:
            # A row split over a page break: its second half has no S.No. Fold it into the previous row.
            if r["continuation"] and rows:
                prev = rows[-1]
                for key in ("company", "industry", "remarks", "next_action"):
                    if r[key]:
                        prev[key] = (prev[key] + " " + r[key]).strip() if key != "industry" else (prev[key] + r[key] if prev[key] and not prev[key].endswith(" ") else prev[key] + " " + r[key]).strip()
                for e in r["emails"]:
                    if e.lower() not in [x.lower() for x in prev["emails"]]:
                        prev["emails"].append(e)
                if not prev["website"] and r["website"]:
                    prev["website"] = r["website"]
                if not prev["location"] and r["location"]:
                    prev["location"] = r["location"]
                continue
            if r["sno"] is not None:
                rows.append(r)

    # Repair addresses the PDF text cut short, using the firm's (final, merged) website.
    for r in rows:
        r["emails"] = [repair_with_website(e, r["website"]) for e in r["emails"]]
        # An address cut off after a hyphen ("info@metallverarbeitung-"): a sibling address in the same row shows the domain.
        fixed = []
        for e in r["emails"]:
            local, _, domain = e.partition("@")
            if domain.endswith("-"):
                sib = next((x.split("@", 1)[1] for x in r["emails"] if x != e and x.split("@", 1)[1].lower().startswith(domain.lower())), None)
                if sib:
                    e = local + "@" + sib
            fixed.append(e)
        r["emails"] = fixed

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print(f"{len(rows)} rows from {n} pages -> {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
