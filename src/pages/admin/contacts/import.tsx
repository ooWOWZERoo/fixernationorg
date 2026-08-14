import Head from "next/head";
import { useRef, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TOPICS = [
  { key: "MORNING_BOOST", label: "Morning Boost" },
  { key: "CAMPAIGNS", label: "Campaigns" },
  { key: "NEWSLETTERS", label: "Newsletters" },
  { key: "PRODUCT_UPDATES", label: "Product Updates" },
] as const;

interface ParsedContact {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  source: string;
}

interface ParseResult {
  contacts: ParsedContact[];
  skippedRows: number;
  detectedColumns: string[];
}

interface ImportResult {
  created: number;
  existing: number;
  total: number;
  consentAdded: number;
}

// ─── CSV parser ─────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[\s_\-\.]+/g, "");
}

const COLUMN_MAP: Record<string, keyof ParsedContact> = {
  email: "email",
  emailaddress: "email",
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  name: "firstName",
  fullname: "firstName",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  cell: "phone",
  telephone: "phone",
  company: "company",
  organization: "company",
  organisation: "company",
  org: "company",
  business: "company",
  source: "source",
};

function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { contacts: [], skippedRows: 0, detectedColumns: [] };

  const rawHeaders = splitCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const fieldMap = rawHeaders.map((h) => COLUMN_MAP[norm(h)] ?? null);
  const detectedColumns = rawHeaders.filter((_, i) => fieldMap[i] !== null);

  let skippedRows = 0;
  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Partial<ParsedContact> = {};
    rawHeaders.forEach((_, j) => {
      const field = fieldMap[j];
      if (field && values[j]) {
        if (field === "firstName" && rawHeaders[j] && norm(rawHeaders[j]) === "fullname") {
          // Split "Full Name" into first + last
          const parts = values[j].trim().split(/\s+/);
          row.firstName = parts[0] ?? "";
          row.lastName = parts.slice(1).join(" ");
        } else {
          row[field] = values[j];
        }
      }
    });

    if (!row.email) { skippedRows++; continue; }
    contacts.push({
      email: row.email.toLowerCase(),
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      phone: row.phone ?? "",
      company: row.company ?? "",
      source: row.source ?? "",
    });
  }

  return { contacts, skippedRows, detectedColumns };
}

// ─── Page ────────────────────────────────────────────────────────────────────

const AdminContactImportPage: NextPageWithLayout = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [consentTopics, setConsentTopics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParseResult(parseCSV(text));
    };
    reader.readAsText(file);
  }

  function toggleTopic(key: string) {
    setConsentTopics((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  async function handleImport() {
    if (!parseResult || parseResult.contacts.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: parseResult.contacts,
          consentTopics: consentTopics.length > 0 ? consentTopics : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setParseResult(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const preview = parseResult?.contacts.slice(0, 5) ?? [];

  return (
    <>
      <Head><title>Import Contacts — Admin</title></Head>

      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <a href="/admin/contacts" className="hover:underline">Contacts</a>
        <span>/</span>
        <span>Import CSV</span>
      </div>

      <h1 className="mb-6 text-2xl font-extrabold text-navy">Import contacts</h1>

      <div className="mx-auto max-w-2xl space-y-6">

        {/* Upload */}
        <div className="rounded-2xl border border-navy/8 bg-white p-6">
          <h2 className="mb-1 text-sm font-bold text-navy">Select CSV file</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Required column: <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">email</code>.
            Optional: <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">first_name</code>,{" "}
            <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">last_name</code>,{" "}
            <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">phone</code>,{" "}
            <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">company</code>,{" "}
            <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">source</code>.
            Column names are flexible — spaces, underscores, and casing don't matter.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-xl file:border-0 file:bg-navy/8 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy hover:file:bg-navy/15"
          />
          {fileName && !parseResult && (
            <p className="mt-2 text-xs text-ink-soft">Reading {fileName}…</p>
          )}
        </div>

        {/* Parse result / preview */}
        {parseResult && (
          <>
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-navy">
                    {parseResult.contacts.length} contacts ready to import
                  </h2>
                  {parseResult.skippedRows > 0 && (
                    <p className="text-xs text-amber-dark">
                      {parseResult.skippedRows} row{parseResult.skippedRows !== 1 ? "s" : ""} skipped (missing email)
                    </p>
                  )}
                  {parseResult.detectedColumns.length > 0 && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Columns mapped: {parseResult.detectedColumns.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {preview.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-navy/8 text-left font-bold uppercase tracking-widest text-ink-soft">
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Company</th>
                        <th className="pb-2">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((c, i) => (
                        <tr key={i} className="border-b border-navy/5">
                          <td className="py-1.5 pr-4 text-ink">{c.email}</td>
                          <td className="py-1.5 pr-4 text-ink-soft">
                            {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="py-1.5 pr-4 text-ink-soft">{c.company || "—"}</td>
                          <td className="py-1.5 text-ink-soft">{c.phone || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.contacts.length > 5 && (
                    <p className="mt-2 text-xs text-ink-soft">
                      …and {parseResult.contacts.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-1 text-sm font-bold text-navy">Opt in to email lists (optional)</h2>
              <p className="mb-4 text-xs text-ink-soft">
                Check any topics to record consent for all imported contacts. Contacts who already have a consent record for a topic won't be changed.
              </p>
              <div className="space-y-2">
                {TOPICS.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={consentTopics.includes(key)}
                      onChange={() => toggleTopic(key)}
                      className="h-4 w-4 cursor-pointer accent-navy"
                    />
                    <span className="text-sm font-medium text-ink">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={submitting || parseResult.contacts.length === 0}
                className="rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60"
              >
                {submitting
                  ? "Importing…"
                  : `Import ${parseResult.contacts.length} contact${parseResult.contacts.length !== 1 ? "s" : ""}`}
              </button>
              <a
                href="/admin/contacts"
                className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline"
              >
                Cancel
              </a>
            </div>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <h2 className="mb-3 text-sm font-bold text-green-800">Import complete</h2>
            <div className="space-y-1 text-sm text-green-700">
              <p>{result.created} contact{result.created !== 1 ? "s" : ""} added</p>
              {result.existing > 0 && (
                <p>{result.existing} skipped — email already in contacts</p>
              )}
              {result.consentAdded > 0 && (
                <p>{result.consentAdded} consent record{result.consentAdded !== 1 ? "s" : ""} added</p>
              )}
            </div>
            <a
              href="/admin/contacts"
              className="mt-4 inline-block rounded-xl bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark no-underline"
            >
              View contacts
            </a>
          </div>
        )}
      </div>
    </>
  );
};

AdminContactImportPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminContactImportPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};
