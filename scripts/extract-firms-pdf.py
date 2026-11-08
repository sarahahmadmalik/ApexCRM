"""
Extracts the firm contact list PDF into JSON (one object per table row).

    python scripts/extract-firms-pdf.py "Dua Dev UG-FirmContactList_DE_11092026_1.pdf" supabase/data/firm-contact-list.json

Needs PyMuPDF:  pip install pymupdf

Columns in the PDF (German): S.No, Unternehmen (company), E-Mail-Adresse, Stadt/Land (city, country),
Webseite (website), Branche (industry), Datum E-Mail-Versand (date the email was sent), Rueckmeldung
(reply), Aktueller Status (a coloured square), Naechste Aktion (next action), Bemerkungen (remarks).

E-mail addresses and websites are read from the cells' hyperlinks (the visible text is wrapped over
several lines and would be ambiguous); the status is only a coloured square, so its fill colour is read
from the page drawing and stored as `status_color`.
"""
import json
import re
import sys

import pymupdf

SOFT_HYPHEN = "­"
NL = chr(10)


def clean(text):
    """Cell text with PDF line-wrapping undone."""
    if text is None:
        return ""
    return re.sub(r"\s+", " ", text.replace(SOFT_HYPHEN, "")).strip()


def clean_joined(text):
    """For URLs / e-mails, which the PDF wraps mid-string: drop the line breaks entirely."""
    if text is None:
        return ""
    return re.sub(r"\s+", "", text.replace(SOFT_HYPHEN, ""))


def clean_wrapped(text, join_lowercase=True):
    """
    Cell text where the PDF wrapped lines. A break inside a word ("Pharmaceut" / "ical") is joined
    without a space, a break after a hyphen ("Manu-" / "facturing") drops the hyphen, and any other
    break becomes a space.
    """
    if text is None:
        return ""
    lines = [l.strip() for l in text.replace(SOFT_HYPHEN, "").split(NL) if l.strip()]
    out = ""
    for line in lines:
        if not out:
            out = line
        elif out.endswith("-") and line[:1].islower():
            out = out[:-1] + line
        elif join_lowercase and line[:1].islower() and out[-1].isalpha() and len(out.split(" ")[-1]) >= 7:
            out = out + line
        else:
            out = out + " " + line
    return re.sub(r"\s+", " ", out).strip()


def parse_emails(cell):
    """
    One or more e-mail addresses from a cell whose lines are wrapped mid-address. A line holding an "@"
    starts a new address once the previous one already has its "@" (a line that STARTS with "@" continues
    the previous line's local part instead).
    """
    emails = []
    for line in (cell or "").replace(SOFT_HYPHEN, "").split(NL):
        line = line.strip()
        if not line:
            continue
        if emails and not (("@" in line and "@" in emails[-1]) and not line.startswith("@")):
            emails[-1] += line
        else:
            emails.append(line)
    return [e for e in (re.sub(r"\s+", "", e) for e in emails) if re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", e)]


def sanitize_website(url):
    """Drops tracking tails (?utm_source=chatgpt.com), Google Maps listings, and paths the PDF wrapped into garbage."""
    url = re.sub(r"[?&]utm.*$", "", url, flags=re.I).strip()
    if not url or "google.com/maps" in url.lower():
        return ""
    m = re.match(r"(https?://[^/]+)(/.*)?$", url, flags=re.I)
    if m and m.group(2) and (m.group(2).endswith("_") or " " in m.group(2)):
        return m.group(1) + "/"  # a broken path: keep just the site
    return url


def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in rgb)


def main(pdf_path, out_path):
    doc = pymupdf.open(pdf_path)
    rows = []
    for page_no, page in enumerate(doc, start=1):
        links = [(l["from"], l["uri"]) for l in page.get_links() if l.get("uri")]
        squares = []
        for d in page.get_drawings():
            r, fill = d["rect"], d.get("fill")
            if fill and 5 < r.width < 25 and 5 < r.height < 25 and fill != (1.0, 1.0, 1.0):
                squares.append((r, fill))

        for table in page.find_tables().tables:
            for row, raw_cells in zip(table.rows, table.extract()):
                cells = [c or "" for c in raw_cells]  # merged / empty cells come back as None
                sno_match = re.fullmatch(r"(\d{1,5})\s*[.\-]?", clean(cells[0]))
                if not sno_match:
                    continue  # header, legend or spacer row
                sno = sno_match.group(1)
                # Column layout differs slightly between pages (the first page has extra merged header
                # cells), so read the tail from the right: reply | status | next action | remarks.
                remarks, next_action, status_cell, reply = (clean(cells[-1]), clean(cells[-2]), clean(cells[-3]), clean(cells[-4]))
                date_cell = next((clean(c) for c in cells[6:9] if c and re.search(r"\d{2}\.\d{2}\.\d{4}", c)), "")
                dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", date_cell)

                x0, y0, x1, y1 = row.bbox
                color = None
                for r, fill in squares:
                    cy = (r.y0 + r.y1) / 2
                    if y0 - 1 <= cy <= y1 + 1 and r.x0 > 0:
                        color = hex_of(fill)
                        break

                mails, sites = [], []
                for rect, uri in links:
                    cy = (rect.y0 + rect.y1) / 2
                    if not (y0 - 1 <= cy <= y1 + 1):
                        continue
                    if uri.lower().startswith("mailto:"):
                        addr = uri[7:].split("?")[0].strip().replace("%20", "")
                        if addr and addr.lower() not in [m.lower() for m in mails]:
                            mails.append(addr)
                    elif uri.lower().startswith("http") and uri not in sites:
                        sites.append(uri.strip())

                rows.append(
                    {
                        "sno": int(sno),
                        "page": page_no,
                        "company": clean_wrapped(cells[1], join_lowercase=False),
                        "emails": mails if len(mails) == cells[2].count("@") else parse_emails(cells[2]),
                        "location": clean(cells[3]),
                        "website": sanitize_website(sites[0] if sites else clean_joined(cells[4])),
                        "industry": clean_wrapped(cells[5]),
                        "sent_dates": dates,
                        "reply": reply,
                        "status_text": status_cell,
                        "status_color": color,
                        "next_action": next_action,
                        "remarks": clean_wrapped(cells[-1]),
                    }
                )
    rows.sort(key=lambda r: r["sno"])
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print(f"{len(rows)} rows from {len(doc)} pages -> {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
