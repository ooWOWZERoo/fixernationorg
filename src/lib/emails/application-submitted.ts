const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

type ApplicationType = "PROVIDER" | "AMBASSADOR";

const TYPE_LABEL: Record<ApplicationType, string> = {
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
};

export function buildApplicationSubmittedEmail(
  firstName: string,
  type: ApplicationType,
  verifyToken: string
): { subject: string; html: string; text: string } {
  const label = TYPE_LABEL[type];
  const verifyUrl = `${BASE_URL}/api/applications/verify-email?token=${verifyToken}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
            <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">Got it, ${firstName}.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">Your ${label.toLowerCase()} application came through. Before we review it, we need to confirm this email address is yours.</p>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#1e293b;">Click the button below to verify — the link works for 72 hours.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:8px 32px 32px 32px;">
            <a href="${verifyUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Confirm my email</a>
          </td>
        </tr>
        <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>
        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.6;">After you verify, we'll review your application personally. That typically takes a few business days. We'll follow up at this address when we have news.</p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Got it, ${firstName}.

Your ${label.toLowerCase()} application came through. Verify your email address to complete the submission:

${verifyUrl}

This link works for 72 hours. After you verify, we'll review your application personally and follow up at this address.

---
Fixer Nation · ${BASE_URL}`;

  return {
    subject: `Verify your email — Fixer Nation ${label} application`,
    html,
    text,
  };
}

export function buildApplicationAdminNotifyEmail(
  name: string,
  type: ApplicationType,
  applicationId: string
): { subject: string; html: string; text: string } {
  const label = TYPE_LABEL[type];
  const adminUrl = `${BASE_URL}/admin/applications`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New ${label} application</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;">
        <tr><td style="background:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:20px 28px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND_ORANGE};">New Application</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:800;color:#fff;">New ${label}: ${name}</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">A new ${label.toLowerCase()} application just came in. Review it in the admin panel.</p>
          <a href="${adminUrl}" style="display:inline-block;background:${BRAND_NAVY};color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:10px;">Review application</a>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Application ID: ${applicationId}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `New ${label} application from ${name}.

Review it: ${adminUrl}

Application ID: ${applicationId}
---
Fixer Nation`;

  return {
    subject: `New ${label} application — ${name}`,
    html,
    text,
  };
}
