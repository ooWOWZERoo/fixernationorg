import { db } from "@/lib/db";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

function substitute(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function textToHtml(text: string): string {
  const paragraphs = text.trim().split(/\n\n+/);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#1e293b;">${p
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
}

function wrapShell(inner: string, eyebrow: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${eyebrow}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 32px 24px 32px;">
            ${inner}
          </td>
        </tr>
        <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>
        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function loadTemplate(
  key: string,
  vars: Record<string, string>
): Promise<RenderedEmail | null> {
  try {
    const tmpl = await db.messageTemplate.findUnique({ where: { key } });
    if (!tmpl) return null;

    const subject = substitute(tmpl.subject, vars);
    const text = substitute(tmpl.body, vars);
    const role = vars.role ?? "Fixer Nation";
    const html = wrapShell(textToHtml(text), `${role} Application`);

    return { subject, html, text };
  } catch {
    return null;
  }
}

export function previewTemplate(
  subject: string,
  body: string,
  vars: Record<string, string>
): RenderedEmail {
  const subjectOut = substitute(subject, vars);
  const text = substitute(body, vars);
  const role = vars.role ?? "Fixer Nation";
  const html = wrapShell(textToHtml(text), `${role} Application`);
  return { subject: subjectOut, html, text };
}

export { substitute };
