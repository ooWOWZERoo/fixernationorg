import { buildMarketingFooter } from "@/lib/campaign-email";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Instant welcome for the trial landing page's "30 days of Morning Boosts"
// signup. Sent right after the form is submitted (see api/public/subscribe).
export function buildMorningBoostWelcomeEmail(
  firstName: string | null | undefined,
  unsubscribeUrl: string
): { subject: string; html: string; text: string } {
  const name = firstName?.trim().split(/\s+/)[0] || "there";
  const boostUrl = `${BASE_URL}/morning-boost`;
  const joinUrl = `${BASE_URL}/join`;
  const footer = buildMarketingFooter(unsubscribeUrl);

  const p = (inner: string) => `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">${inner}</p>`;
  const link = (href: string, label: string) => `<a href="${href}" style="color:${BRAND_NAVY};font-weight:600;">${label}</a>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're in. Your 30 days of Morning Boosts start now</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Look for your first one in the morning.</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">Morning Boost</p>
              <p style="margin:6px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">You're in. Your 30 days start now.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
              ${p(`Hi ${escapeHtml(name)},`)}
              ${p("You're signed up. Every morning for the next 30 days, we'll send you a short Morning Boost to help you reset, refocus, and start the day with something positive.")}
              ${p("Look for the next one in your inbox in the morning. If you don't see it, check your spam or promotions folder and mark us as safe.")}
              ${p(`Want to read today's boost now? It's waiting at ${link(boostUrl, "fixernation.org/morning-boost")}.`)}
              ${p(`If you'd like more than a daily email, a free 30-day Fixer Nation trial gives you goals, plans, challenges and the community. You can start it any time at ${link(joinUrl, "fixernation.org/join")}.`)}
              ${p("One better morning at a time,<br>The Fixer Nation Team")}
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:0 32px 24px 32px;">
              ${footer.html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${name},`,
    "",
    "You're signed up. Every morning for the next 30 days, we'll send you a short Morning Boost to help you reset, refocus, and start the day with something positive.",
    "",
    "Look for the next one in your inbox in the morning. If you don't see it, check your spam or promotions folder and mark us as safe.",
    "",
    `Want to read today's boost now? It's waiting at ${boostUrl}`,
    "",
    `If you'd like more than a daily email, a free 30-day Fixer Nation trial gives you goals, plans, challenges and the community. You can start it any time at ${joinUrl}`,
    "",
    "One better morning at a time,",
    "The Fixer Nation Team",
  ].join("\n") + footer.text;

  return { subject: "You're in. Your 30 days of Morning Boosts start now", html, text };
}
