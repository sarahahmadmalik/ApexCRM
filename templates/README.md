# Document templates

These `.docx` files are merge-field templates rendered by [docxtemplater](https://docxtemplater.com/). Every `{tag}` below gets replaced with real data when a document is generated from the app — everything else in the file (layout, the Dua Dev letterhead, fonts, colors) is printed as-is.

Every document (offers, invoices, contracts) can also be downloaded as a **PDF**, drawn directly from the same data with `pdf-lib` — that path needs no template at all, so it works even for documents whose `.docx` template hasn't been added yet (see `src/lib/documents/pdf.ts`).

## angebot-template.docx / rechnung-template.docx

Built from your uploaded `Dua_Dev_UG-Angebotsvorlage.docx` and `Dua_Dev_UG-Rechnungvorlage.docx` — same letterhead, header, footer and layout, with the sample data swapped for tags:

| Tag | Meaning |
|---|---|
| `{salutation}` | Full greeting line, e.g. "Sehr geehrte(r) Jane Doe," |
| `{signer_name}` | Who signs the letter |
| `{firm_name}`, `{firm_department}`, `{contact_name}`, `{firm_address_line}`, `{firm_postal_city}` | Recipient address block |
| `{angebot_number}` / `{invoice_number}` | Auto-generated, never repeats |
| `{issue_date}`, `{valid_until}` (Angebot) / `{due_date}`, `{service_period}` (Rechnung) | Dates |
| `{customer_number}` | Short firm reference code |
| `{#items}...{/items}` loop over one table row, with `{pos}`, `{description}`, `{quantity}`, `{unit_price}`, `{total}` | Line items |
| `{net_amount}`, `{vat_rate}`, `{vat_amount}`, `{total_amount}` | Totals |

To restyle either document, edit the `.docx` in Word/LibreOffice directly — just don't remove or rename the `{tags}`.

## contract-template.docx — not added yet

Employee contract generation is fully wired up in the app (the Employees and Contracts pages, the database, storage) but the Word path is waiting on your contract template — the PDF download works today without it. Once you have a template:

1. Add the tags below wherever that info belongs in the document:
   `{employee_name}`, `{position}`, `{start_date}`, `{end_date}`, `{salary}`, `{notes}`
2. Save it as `templates/contract-template.docx` in this repo.
3. Re-deploy. Word contract generation starts working immediately — no code changes needed.

`{salary}` arrives pre-formatted, e.g. `4.500,00 € / month` — the employee's salary amount and period (month/year) combined.

Until then, downloading a contract as Word shows a message pointing at the PDF instead; the PDF download always works.
