const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

interface Entry {
  title: string;
  body: string;
  authorName: string;
  publishedAt: Date;
  slug: string;
  excerpt?: string | null;
  imageUrl?: string | null;
}

export function buildMorningBoostEmail(
  entry: Entry,
  recipientName: string | null
): { subject: string; html: string; text: string } {
  const dateStr = entry.publishedAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const readUrl = `${BASE_URL}/morning-boost/${entry.slug}`;
  const unsubscribeUrl = `${BASE_URL}/account`;

  const greeting = recipientName ? `Good morning, ${recipientName.split(" ")[0]}.` : "Good morning.";

  const paragraphs = entry.body
    .split(/\n\n+/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const coverImage = entry.imageUrl
    ? `<div style="margin:0 0 28px 0;"><img src="${entry.imageUrl}" alt="${escape(entry.title)}" style="width:100%;max-width:560px;height:auto;border-radius:12px;display:block;" /></div>`
    : "";

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${entry.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">Morning Boost</p>
              <p style="margin:6px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">${entry.title}</p>
              <p style="margin:10px 0 0 0;font-size:13px;color:#94a3b8;">${entry.authorName} · ${dateStr}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#475569;">${greeting}</p>
              ${coverImage}
              ${paragraphs}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background-color:#ffffff;padding:8px 32px 32px 32px;">
              <a href="${readUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Read on Fixer Nation →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background-color:#ffffff;padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:20px 32px 24px 32px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You're receiving this because you're a Fixer Nation member.<br>
                <a href="${unsubscribeUrl}" style="color:#94a3b8;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBody = `${greeting}

${entry.title}
${entry.authorName} · ${dateStr}
${"-".repeat(50)}

${entry.body}

Read on Fixer Nation: ${readUrl}

---
Manage email preferences: ${unsubscribeUrl}
`;

  return {
    subject: `Morning Boost: ${entry.title}`,
    html: htmlBody,
    text: textBody,
  };
}

function escape(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
