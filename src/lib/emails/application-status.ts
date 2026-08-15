const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

type ApplicationType = "PROVIDER" | "AMBASSADOR";

const TYPE_LABEL: Record<ApplicationType, string> = {
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
};

function firstName(name: string | null | undefined): string {
  return (name ?? "").split(" ")[0] || "there";
}

function shell(innerRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        ${innerRows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildUnderReviewEmail(
  name: string | null | undefined,
  type: ApplicationType
): { subject: string; html: string; text: string } {
  const label = TYPE_LABEL[type];
  const first = firstName(name);

  const html = shell(`
    <tr>
      <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
        <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">Your application is under review, ${first}.</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:32px 32px 24px 32px;">
        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">We're going through your ${label.toLowerCase()} application now. This typically takes a few business days.</p>
        <p style="margin:0;font-size:16px;line-height:1.7;color:#1e293b;">We'll follow up here when we have an update. No action is needed from you right now.</p>
      </td>
    </tr>
    <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>
    <tr>
      <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
      </td>
    </tr>`);

  const text = `Your application is under review, ${first}.

We're going through your ${label.toLowerCase()} application now. This typically takes a few business days.

We'll follow up here when we have an update. No action is needed from you right now.

---
Fixer Nation · ${BASE_URL}`;

  return {
    subject: `Your ${label.toLowerCase()} application is under review`,
    html,
    text,
  };
}

export function buildInfoRequestEmail(
  name: string | null | undefined,
  type: ApplicationType,
  message: string
): { subject: string; html: string; text: string } {
  const label = TYPE_LABEL[type];
  const first = firstName(name);
  const contactUrl = `${BASE_URL}/contact`;

  const html = shell(`
    <tr>
      <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
        <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">We have a question, ${first}.</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">We're reviewing your ${label.toLowerCase()} application and we need a bit more information before we can move forward.</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:0 32px 24px 32px;">
        <div style="border-left:4px solid ${BRAND_ORANGE};padding:16px 20px;background-color:#fffbf5;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:0 32px 32px 32px;">
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#1e293b;">Reply to this email or use the contact form to get back to us.</p>
        <a href="${contactUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Contact Fixer Nation</a>
      </td>
    </tr>
    <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>
    <tr>
      <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
      </td>
    </tr>`);

  const text = `We have a question, ${first}.

We're reviewing your ${label.toLowerCase()} application and we need a bit more information before we can move forward.

---
${message}
---

Reply to this email or visit ${contactUrl} to get back to us.

Fixer Nation · ${BASE_URL}`;

  return {
    subject: `Question about your Fixer Nation ${label.toLowerCase()} application`,
    html,
    text,
  };
}

export function buildConditionalAcceptanceEmail(
  name: string | null | undefined,
  type: ApplicationType,
  notes?: string | null
): { subject: string; html: string; text: string } {
  const label = TYPE_LABEL[type];
  const first = firstName(name);
  const contactUrl = `${BASE_URL}/contact`;

  const notesBlock = notes
    ? `<tr>
      <td style="background-color:#ffffff;padding:0 32px 24px 32px;">
        <div style="border-left:4px solid #0ea5e9;padding:16px 20px;background-color:#f0f9ff;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0284c7;">Next steps from us</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      </td>
    </tr>`
    : "";

  const notesText = notes ? `\nNext steps from us:\n${notes}\n` : "";

  const html = shell(`
    <tr>
      <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
        <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">Good news, ${first}.</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:32px 32px 24px 32px;">
        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">Your ${label.toLowerCase()} application has been conditionally accepted. We'd like to move forward, and there are a few things to wrap up first.</p>
      </td>
    </tr>
    ${notesBlock}
    <tr>
      <td style="background-color:#ffffff;padding:0 32px 32px 32px;">
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#1e293b;">Reply to this email if you have questions.</p>
        <a href="${contactUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Contact Fixer Nation</a>
      </td>
    </tr>
    <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>
    <tr>
      <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
      </td>
    </tr>`);

  const text = `Good news, ${first}.

Your ${label.toLowerCase()} application has been conditionally accepted. We'd like to move forward, and there are a few things to wrap up first.
${notesText}
Reply to this email if you have questions.

Fixer Nation · ${BASE_URL}`;

  return {
    subject: `Your Fixer Nation ${label.toLowerCase()} application — conditional acceptance`,
    html,
    text,
  };
}
