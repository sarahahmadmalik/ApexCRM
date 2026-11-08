/**
 * Converts a filled .docx into a PDF that looks exactly like the Word file
 * (same letterhead, fonts, layout), by sending it to CloudConvert.
 *
 * Why an external service: LibreOffice/Word can't run inside Vercel's
 * serverless functions, and re-drawing the template in code never matches it.
 *
 * Needs CLOUDCONVERT_API_KEY (server only). Create one at
 * cloudconvert.com -> Dashboard -> API Keys with the `task.read` and `task.write` scopes.
 */
export async function convertDocxToPdf(docx: Buffer, fileName: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PDF export needs CLOUDCONVERT_API_KEY to be set (it converts the Word template to PDF). Add it to the environment and re-deploy."
    );
  }
  const authHeaders = { Authorization: `Bearer ${apiKey}` };

  // The sync endpoint holds the request open until the job has finished.
  const jobRes = await fetch("https://sync.api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: {
        upload: { operation: "import/base64", file: docx.toString("base64"), filename: fileName },
        convert: { operation: "convert", input: "upload", input_format: "docx", output_format: "pdf" },
        export: { operation: "export/url", input: "convert" },
      },
    }),
  });
  if (!jobRes.ok) {
    throw new Error(`PDF conversion failed (${jobRes.status}). ${(await jobRes.text()).slice(0, 200)}`);
  }

  const job = (await jobRes.json()) as {
    data?: {
      status?: string;
      tasks?: { name: string; status: string; message?: string | null; result?: { files?: { url: string }[] } }[];
    };
  };
  const failed = job.data?.tasks?.find((t) => t.status === "error");
  if (failed) throw new Error(`PDF conversion failed: ${failed.message ?? "unknown error"}`);

  const url = job.data?.tasks?.find((t) => t.name === "export")?.result?.files?.[0]?.url;
  if (!url) throw new Error("PDF conversion didn't return a file. Please try again.");

  const pdfRes = await fetch(url);
  if (!pdfRes.ok) throw new Error(`Couldn't download the converted PDF (${pdfRes.status}).`);
  return Buffer.from(await pdfRes.arrayBuffer());
}
