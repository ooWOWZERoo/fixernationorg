const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

type ApplicationType = "PROVIDER" | "AMBASSADOR";

const TYPE_LABEL: Record<ApplicationType, string> = {
  PROVIDER: "Provider",
  AMBASSADOR: "Ambassador",
};

export function buildApplicationApprovedEmail(
  name: string,
  type: ApplicationType
): { subject: string; htmlBody: string; textBody: string } {
  const label = TYPE_LABEL[type];
  const dashboardUrl = `${BASE_URL}/dashboard`;
  const first = name.split(" ")[0];

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Application approved</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
            <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">You're in, ${first}.</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">We went through your application and we'd love to have you as a ${label} in Fixer Nation. Your account has been upgraded, so sign in and take a look around.</p>
            <p style="margin:0 0 28px 0;font-size:16px;line-height:1.7;color:#1e293b;">If you have questions about what's next, just reply to this email.</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:8px 32px 32px 32px;">
            <a href="${dashboardUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Sign in to Fixer Nation</a>
          </td>
        </tr>

        <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>

        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textBody = `You're in, ${first}.

We went through your application and we'd love to have you as a ${label} in Fixer Nation. Your account has been upgraded, so sign in and take a look around.

If you have questions about what's next, just reply to this email.

Sign in: ${dashboardUrl}

---
Fixer Nation · ${BASE_URL}
`;

  return {
    subject: `Good news: your ${label.toLowerCase()} application is approved`,
    htmlBody,
    textBody,
  };
}

export function buildApplicationRejectedEmail(
  name: string,
  type: ApplicationType
): { subject: string; htmlBody: string; textBody: string } {
  const label = TYPE_LABEL[type];
  const first = name.split(" ")[0];
  const dashboardUrl = `${BASE_URL}/dashboard`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Fixer Nation application</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">${label} Application</p>
            <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">Hi ${first},</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:32px 32px 24px 32px;">
            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">We looked at your ${label} application and we're not moving forward with it right now. We know that's not the answer you were hoping for.</p>
            <p style="margin:0;font-size:16px;line-height:1.7;color:#1e293b;">Your account is still active if you want to stay connected as a Fixer Nation member.</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:8px 32px 32px 32px;">
            <a href="${dashboardUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Go to my account</a>
          </td>
        </tr>

        <tr><td style="background-color:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>

        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Fixer Nation &middot; <a href="${BASE_URL}" style="color:#94a3b8;">fixernation.org</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textBody = `Hi ${first},

We looked at your ${label} application and we're not moving forward with it right now. We know that's not the answer you were hoping for.

Your account is still active if you want to stay connected as a Fixer Nation member.

Go to your account: ${dashboardUrl}

---
Fixer Nation · ${BASE_URL}
`;

  return { subject: "Your Fixer Nation application", htmlBody, textBody };
}
