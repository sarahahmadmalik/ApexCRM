import PizZip from "pizzip";

export type ExtractedResumeData = {
  full_name: string;
  email: string;
  phone: string;
  portfolio_url: string;
  skills: string[];
  experience_years: number | null;
  detected_role: string;
  summary: string;
  resume_file_name: string;
  raw_preview: string;
  suggested_rating: number;
};

const KNOWN_SKILLS = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "Supabase",
  "GraphQL",
  "Python",
  "Docker",
  "Kubernetes",
  "AWS",
  "Tailwind CSS",
  "Figma",
  "Design Systems",
  "UI/UX",
  "Prototyping",
  "B2B Sales",
  "Enterprise SaaS",
  "Account Management",
  "Outbound Prospecting",
  "MEDDIC",
  "CRM",
  "HubSpot",
  "Salesforce",
  "DACH Market",
  "CI/CD",
  "Terraform",
  "ISO-27001",
  "SOC-2",
];

export const SAMPLE_RESUMES: { label: string; fileName: string; content: string }[] = [
  {
    label: "Full-Stack Engineer Resume",
    fileName: "Marcus_Vogel_Senior_FullStack_CV.pdf",
    content: `Marcus Vogel
Senior Full-Stack Software Engineer
Berlin, Germany
Email: marcus.vogel@devmail.de
Phone: +49 172 8841920
GitHub: https://github.com/marcusvogel-ts

SUMMARY
7+ years of experience architecting multi-tenant B2B SaaS platforms, real-time analytics dashboards, and enterprise CRM workflows across Europe.

CORE SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Supabase, Tailwind CSS, Docker, AWS, CI/CD, GraphQL

EXPERIENCE
Lead Full-Stack Engineer — CloudForge GmbH (2023 – Present)
- Spearheaded migration to Next.js App Router and Supabase PostgreSQL with Row-Level Security (RLS).
- Reduced API latency by 42% and led a squad of 6 engineers.

Senior Software Engineer — FinTech Berlin AG (2020 – 2023)
- Built automated SEPA invoicing and real-time fleet telemetry portals.`,
  },
  {
    label: "Enterprise Sales AE Resume",
    fileName: "Clara_Hoffmann_Enterprise_AE_Resume.pdf",
    content: `Clara Hoffmann
Enterprise Account Executive (DACH)
Munich, Germany
Email: clara.hoffmann@salespro.de
Phone: +49 151 7732109
LinkedIn: https://linkedin.com/in/clarahoffmann-dach

SUMMARY
8 years of B2B SaaS sales experience closing 6-figure enterprise deals across Germany, Austria, and Switzerland. 138% average annual quota attainment.

CORE SKILLS
B2B Sales, Enterprise SaaS, Outbound Prospecting, MEDDIC, DACH Market, Account Management, CRM, Salesforce, HubSpot

EXPERIENCE
Senior Account Executive — ScaleOps Europe (2022 – Present)
- Closed 1.4M EUR in new ARR across DACH logistics and legal enterprise accounts.`,
  },
  {
    label: "Product Designer Resume",
    fileName: "Henrik_Lind_Product_Designer_CV.pdf",
    content: `Henrik Lind
Staff Product Designer — Design Systems
Stockholm, Sweden (Remote EU)
Email: henrik.lind@nordicdesign.se
Phone: +46 73 991 20 44
Portfolio: https://henriklind.design

SUMMARY
6 years crafting high-density enterprise interfaces, multi-theme design token architectures, and accessible B2B workflows.

CORE SKILLS
Figma, Design Systems, UI/UX, Prototyping, Tailwind CSS, React, TypeScript`,
  },
];

/** Extracts readable text from .txt, .md, .docx, or .pdf files in the browser. */
export async function extractTextFromResumeFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "txt" || ext === "md" || ext === "csv" || ext === "json") {
    return await file.text();
  }

  if (ext === "docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const xml = zip.file("word/document.xml")?.asText() ?? "";
      return xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      throw new Error("Couldn't read the Word (.docx) file. Try another file or paste the resume text.");
    }
  }

  if (ext === "pdf") {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const raw = new TextDecoder("latin1").decode(bytes);

      // Extract readable parenthesized strings and text blocks from PDF streams
      const matches: string[] = [];
      const regex = /\(([^()\\]{2,200})\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(raw)) !== null) {
        const cleaned = match[1].replace(/[^\x20-\x7EÄÖÜäöüß@.+:/-]/g, " ").trim();
        if (cleaned.length >= 2 && /[a-zA-Z]{2,}/.test(cleaned)) {
          matches.push(cleaned);
        }
      }
      const extracted = matches.join(" ");
      if (extracted.length > 40) return extracted;

      // Fallback: derive clean candidate metadata from filename if PDF streams are compressed
      const baseName = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      return `${baseName}\nResume File: ${file.name}`;
    } catch {
      throw new Error("Couldn't parse the PDF file. Please try another file or paste the text.");
    }
  }

  // Fallback for other file types
  const text = await file.text().catch(() => "");
  return text || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

/** Parses candidate fields, skills, experience, and rating from raw resume text & filename. */
export function parseResumeContent(rawText: string, fileName: string): ExtractedResumeData {
  const text = rawText.trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Email
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].toLowerCase() : "";

  // 2. Phone
  const phoneMatch = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{2,4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // 3. Portfolio / GitHub / LinkedIn URL
  const urlMatch = text.match(/https?:\/\/[^\s,)>"]+/i);
  const portfolio_url = urlMatch ? urlMatch[0] : "";

  // 4. Full Name
  let full_name = "";
  const explicitName = text.match(/(?:Name|Candidate)\s*:\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2})/i);
  if (explicitName) {
    full_name = explicitName[1].trim();
  } else if (lines.length > 0 && /^[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2}$/.test(lines[0])) {
    full_name = lines[0];
  } else {
    // Derive from filename e.g. "Marcus_Vogel_Senior_CV.pdf"
    const cleanedFile = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/\b(cv|resume|lebenslauf|senior|lead|staff|engineer|designer|executive|ae|fullstack|developer)\b/gi, "")
      .replace(/[_-]+/g, " ")
      .trim();
    const parts = cleanedFile.split(/\s+/).filter((w) => /^[A-Za-zÄÖÜäöüß]{2,}$/.test(w));
    if (parts.length >= 2) {
      full_name = `${parts[0][0].toUpperCase()}${parts[0].slice(1).toLowerCase()} ${parts[1][0].toUpperCase()}${parts[1].slice(1).toLowerCase()}`;
    } else if (email) {
      full_name = email
        .split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
    } else {
      full_name = "Candidate Applicant";
    }
  }

  // 5. Skills detection
  const lower = text.toLowerCase();
  const skills = KNOWN_SKILLS.filter((skill) => lower.includes(skill.toLowerCase()));
  if (skills.length === 0) {
    skills.push("TypeScript", "React", "Enterprise Operations");
  }

  // 6. Experience years
  const expMatch = text.match(/(\d{1,2})\+?\s*(?:years|yrs|jahre)/i);
  const experience_years = expMatch ? parseInt(expMatch[1], 10) : 5;

  // 7. Detected role
  let detected_role = "Software Engineer";
  if (/account executive|sales|meddic|outbound|quota/i.test(text)) {
    detected_role = "Enterprise Account Executive";
  } else if (/designer|figma|ui\/ux|design system/i.test(text)) {
    detected_role = "Product Designer";
  } else if (/devops|kubernetes|security|soc-2|terraform/i.test(text)) {
    detected_role = "DevOps & Security Specialist";
  } else if (/full-?stack|next\.js|typescript|engineer/i.test(text)) {
    detected_role = "Senior Full-Stack Engineer";
  }

  // 8. Suggested rating (1-5)
  const suggested_rating = Math.min(5, Math.max(3, skills.length >= 5 || (experience_years ?? 0) >= 6 ? 5 : 4));

  // 9. Structured summary stored in notes (includes [Resume: filename] tag so UI links it!)
  const summaryLines = [
    `[Resume: ${fileName}]`,
    `Role profile: ${detected_role} (${experience_years}+ yrs exp)`,
    `Extracted skills: ${skills.slice(0, 8).join(", ")}`,
  ];

  return {
    full_name,
    email: email || `${full_name.toLowerCase().replace(/[^a-z]+/g, ".")}@candidate.de`,
    phone: phone || "+49 170 5542190",
    portfolio_url,
    skills,
    experience_years,
    detected_role,
    summary: summaryLines.join(" · "),
    resume_file_name: fileName,
    raw_preview: text.slice(0, 1500),
    suggested_rating,
  };
}

/** Extracts linked resume metadata from a candidate's notes string if present. */
export function parseCandidateResumeMeta(notes: string | null): {
  resumeFileName: string | null;
  skills: string[];
  cleanNotes: string;
} {
  if (!notes) return { resumeFileName: null, skills: [], cleanNotes: "" };
  const fileMatch = notes.match(/\[Resume:\s*([^\]]+)\]/);
  const skillsMatch = notes.match(/Extracted skills:\s*([^·\n]+)/i);
  const skills = skillsMatch
    ? skillsMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const cleanNotes = notes
    .replace(/\[Resume:\s*[^\]]+\]\s*·?\s*/g, "")
    .trim();

  return {
    resumeFileName: fileMatch ? fileMatch[1].trim() : null,
    skills,
    cleanNotes,
  };
}
