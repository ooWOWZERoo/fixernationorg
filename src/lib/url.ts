// A manually pasted URL is very often missing its scheme (copied from a
// source that hides "https://", or typed by hand as a bare domain). The
// server's validation (z.string().url()) requires a full absolute URL, so
// without this the paste silently fails to save with a generic "Validation
// failed" error and no indication of which field or why.
export function normalizeUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

// Builds a readable message from a Zod safeParse failure response (the
// {error, details: {fieldErrors}} shape returned by this app's admin API
// routes) instead of the bare, unhelpful "Validation failed" string.
export function describeValidationError(data: { error?: string; details?: { fieldErrors?: Record<string, string[]> } }): string {
  const fieldErrors = data.details?.fieldErrors;
  if (fieldErrors) {
    const entries = Object.entries(fieldErrors).filter(([, msgs]) => msgs?.length);
    if (entries.length > 0) {
      const detail = entries.map(([field, msgs]) => `${field}: ${msgs.join(", ")}`).join("; ");
      return `${data.error ?? "Validation failed"} — ${detail}`;
    }
  }
  return data.error ?? "Something went wrong.";
}
