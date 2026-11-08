import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Fill a .docx template (Word merge-field style {tags}) with data and return
 * the generated file as a Buffer. Templates live in /templates at the repo
 * root — see /templates/README.md for the tag reference of each one.
 */
export function renderDocxTemplate(templateFileName: string, data: Record<string, unknown>): Buffer {
  const templatePath = path.join(process.cwd(), "templates", templateFileName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template "${templateFileName}" isn't in /templates yet. Add the file and re-deploy to enable this document.`
    );
  }

  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render(data);

  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}
