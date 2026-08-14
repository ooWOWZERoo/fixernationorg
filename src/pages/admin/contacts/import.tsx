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

interface ParsedAddress {
  type: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
}

interface ParsedContact {
  email: string;
  email2: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  company: string;
  source: string;
  lastActivity: string;
  lastActivityAt: string;
  createdAt: string;
  emailSubscriberStatus: string;
  labels: string[];
  addresses: ParsedAddress[];
}

interface ParseResult {
  contacts: ParsedContact[];
  skippedRows: number;
  detectedColumns: string[];
  hasSubscriberStatus: boolean;
  hasLabels: boolean;
  hasAddresses: boolean;
}

interface ImportResult {
  created: number;
  existing: number;
  total: number;
  consentAdded: number;
  addressesCreated: number;
  listMembershipsAdded: number;
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
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type BasicField = "email" | "email2" | "firstName" | "lastName" | "phone" | "phone2" |
  "company" | "source" | "lastActivity" | "lastActivityAt" | "createdAt" | "emailSubscriberStatus";

const COLUMN_MAP: Record<string, BasicField> = {
  // primary email — Wix uses "Email 1", generic CSVs use "Email" or "Email Address"
  email: "email",
  email1: "email",
  emailaddress: "email",
  // secondary email
  email2: "email2",
  secondaryemail: "email2",
  // name
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  name: "firstName",
  fullname: "firstName",
  // primary phone — Wix uses "Phone 1", generic CSVs use "Phone"
  phone: "phone",
  phone1: "phone",
  phonenumber: "phone",
  mobile: "phone",
  cell: "phone",
  telephone: "phone",
  // secondary phone
  phone2: "phone2",
  secondaryphone: "phone2",
  mobilephone: "phone2",
  // company
  company: "company",
  companyname: "company",
  organization: "company",
  organisation: "company",
  org: "company",
  business: "company",
  // other fields
  source: "source",
  lastactivity: "lastActivity",
  // Wix: "Last Activity Date (UTC+0)" → norm → "lastactivitydateutc0"
  lastactivitydate: "lastActivityAt",
  lastactivitydateutc0: "lastActivityAt",
  // Wix: "Created At (UTC+0)" → norm → "createdatutc0"
  createdat: "createdAt",
  createdatutc0: "createdAt",
  // consent status
  emailsubscriberstatus: "emailSubscriberStatus",
  subscriberstatus: "emailSubscriberStatus",
};

interface AddrCols {
  type: number; street: number; street2: number;
  city: number; state: number; zip: number; country: number;
}

function buildAddressCols(rawHeaders: string[]): AddrCols[] {
  return Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    const find = (suffix: string) =>
      rawHeaders.findIndex((h) =>
        h.trim().toLowerCase() === `address ${n} - ${suffix}`.toLowerCase()
      );
    return {
      type: find("type"),
      street: find("street"),
      street2: find("street line 2"),
      city: find("city"),
      state: find("state/region"),
      zip: find("zip"),
      country: find("country"),
    };
  });
}

function extractAddresses(addrCols: AddrCols[], values: string[]): ParsedAddress[] {
  const addresses: ParsedAddress[] = [];
  for (let i = 0; i < addrCols.length; i++) {
    const cols = addrCols[i];
    const get = (idx: number) => (idx >= 0 ? values[idx]?.trim() ?? "" : "");
    const hasData = [cols.type, cols.street, cols.city, cols.state, cols.zip, cols.country]
      .some((idx) => idx >= 0 && values[idx]?.trim());
    if (!hasData) continue;
    addresses.push({
      type: get(cols.type),
      street: get(cols.street),
      street2: get(cols.street2),
      city: get(cols.city),
      state: get(cols.state),
      zip: get(cols.zip),
      country: get(cols.country),
      isPrimary: i === 0,
    });
  }
  return addresses;
}

function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { contacts: [], skippedRows: 0, detectedColumns: [], hasSubscriberStatus: false, hasLabels: false, hasAddresses: false };

  const rawHeaders = splitCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const fieldMap = rawHeaders.map((h) => COLUMN_MAP[norm(h)] ?? null);
  const addrCols = buildAddressCols(rawHeaders);

  const labelsIdx = rawHeaders.findIndex((h) => norm(h) === "labels");
  const hasLabels = labelsIdx >= 0;
  const hasSubscriberStatus = rawHeaders.some((h) => norm(h) === "emailsubscriberstatus");
  const hasAddresses = addrCols.some(
    (a) => [a.type, a.street, a.city, a.state, a.zip, a.country].some((i) => i >= 0)
  );

  const detectedBasic = rawHeaders.filter((_, i) => fieldMap[i] !== null);
  const detectedColumns = [
    ...detectedBasic,
    ...(hasLabels ? ["Labels"] : []),
    ...(hasSubscriberStatus ? ["Email subscriber status"] : []),
    ...(hasAddresses ? ["Addresses"] : []),
  ];

  let skippedRows = 0;
  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Partial<Record<BasicField, string>> = {};

    rawHeaders.forEach((h, j) => {
      const field = fieldMap[j];
      if (!field) return;
      const val = values[j]?.trim() ?? "";
      if (!val) return;

      if (field === "firstName" && norm(h) === "fullname") {
        const parts = val.split(/\s+/);
        row.firstName = parts[0] ?? "";
        row.lastName = parts.slice(1).join(" ") || row.lastName;
      } else {
        row[field] = val;
      }
    });

    if (!row.email) { skippedRows++; continue; }

    const labels: string[] =
      labelsIdx >= 0 && values[labelsIdx]?.trim()
        ? values[labelsIdx]
            .split(";")
            .map((l) => l.trim())
            .filter((l) => l && l.toLowerCase() !== "ask the fixer")
        : [];

    const addresses = extractAddresses(addrCols, values);

    contacts.push({
      email: row.email.toLowerCase(),
      email2: row.email2 ?? "",
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      phone: row.phone ?? "",
      phone2: row.phone2 ?? "",
      company: row.company ?? "",
      source: row.source ?? "",
      lastActivity: row.lastActivity ?? "",
      lastActivityAt: row.lastActivityAt ?? "",
      createdAt: row.createdAt ?? "",
      emailSubscriberStatus: row.emailSubscriberStatus ?? "",
      labels,
      addresses,
    });
  }

  return { contacts, skippedRows, detectedColumns, hasSubscriberStatus, hasLabels, hasAddresses };
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
            Works with Wix contact exports and general CSVs. Required column:{" "}
            <code className="rounded bg-navy/8 px-1.5 py-0.5 text-xs">email</code>.
            Column names are flexible — spaces, underscores, and capitalization are all fine.
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
              <div className="mb-4">
                <h2 className="text-sm font-bold text-navy">
                  {parseResult.contacts.length} contacts ready to import
                </h2>
                {parseResult.skippedRows > 0 && (
                  <p className="text-xs text-amber-dark">
                    {parseResult.skippedRows} row{parseResult.skippedRows !== 1 ? "s" : ""} skipped (no email)
                  </p>
                )}
                {parseResult.detectedColumns.length > 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    Detected: {parseResult.detectedColumns.join(", ")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {parseResult.hasSubscriberStatus && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                      Subscriber status detected — consent auto-set
                    </span>
                  )}
                  {parseResult.hasLabels && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                      Labels detected — will create lists
                    </span>
                  )}
                  {parseResult.hasAddresses && (
                    <span className="rounded-full bg-navy/8 px-2.5 py-0.5 text-xs font-semibold text-navy">
                      Addresses detected
                    </span>
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
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Lists</th>
                        <th className="pb-2">Addresses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((c, i) => (
                        <tr key={i} className="border-b border-navy/5">
                          <td className="py-1.5 pr-4 text-ink">{c.email}</td>
                          <td className="py-1.5 pr-4 text-ink-soft">
                            {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="py-1.5 pr-4 text-ink-soft">
                            {c.emailSubscriberStatus || "—"}
                          </td>
                          <td className="py-1.5 pr-4 text-ink-soft">
                            {c.labels.length > 0 ? c.labels.length : "—"}
                          </td>
                          <td className="py-1.5 text-ink-soft">
                            {c.addresses.length > 0 ? c.addresses.length : "—"}
                          </td>
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

            {/* Consent checkboxes — only relevant if CSV has no subscriber status */}
            {!parseResult.hasSubscriberStatus && (
              <div className="rounded-2xl border border-navy/8 bg-white p-6">
                <h2 className="mb-1 text-sm font-bold text-navy">Opt in to email lists (optional)</h2>
                <p className="mb-4 text-xs text-ink-soft">
                  Check topics to record consent for all imported contacts. Existing consent records won't be changed.
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
            )}

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
                <p>{result.consentAdded} consent record{result.consentAdded !== 1 ? "s" : ""} set</p>
              )}
              {result.addressesCreated > 0 && (
                <p>{result.addressesCreated} address{result.addressesCreated !== 1 ? "es" : ""} saved</p>
              )}
              {result.listMembershipsAdded > 0 && (
                <p>{result.listMembershipsAdded} list membership{result.listMembershipsAdded !== 1 ? "s" : ""} added</p>
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
