const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";
const BRAND_NAVY = "#0f2460";
const BRAND_ORANGE = "#E8620A";

export type TerritoryRequestKind = "INITIAL" | "ADD" | "CHANGE";

function shell(eyebrow: string, heading: string, paragraphs: string[], ctaLabel: string, ctaUrl: string): string {
  const body = paragraphs
    .map(
      (p, i) =>
        `<p style="margin:0 0 ${i === paragraphs.length - 1 ? 0 : 18}px 0;font-size:16px;line-height:1.7;color:#1e293b;">${p}</p>`
    )
    .join("\n            ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${eyebrow}</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ORANGE};">Territory Request</p>
            <p style="margin:8px 0 0 0;font-size:22px;font-weight:800;color:#ffffff;">${heading}</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:32px 32px 24px 32px;">
            ${body}
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:8px 32px 32px 32px;">
            <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">${ctaLabel}</a>
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
}

function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").split(" ")[0] || "there";
}

function territoryLabel(state: string, county: string): string {
  return `${county}, ${state}`;
}

export function buildTerritoryRequestApprovedEmail(
  name: string | null | undefined,
  state: string,
  county: string,
  kind: TerritoryRequestKind
): { subject: string; html: string; text: string } {
  const first = firstNameOf(name);
  const label = territoryLabel(state, county);
  const url = `${BASE_URL}/account`;

  const paragraphs =
    kind === "CHANGE"
      ? [
          `${label} is yours as of today. Your previous territory has been moved over, and the change is already live on your account.`,
          `Everything that was tied to the old territory carries forward, so you don't need to redo anything on your end.`,
          `If you have questions about the new boundary, just reply to this email.`,
        ]
      : [
          `${label} is yours as of today, and it's already showing on your account.`,
          kind === "ADD"
            ? `This one sits alongside the territory you already had, so you're covering both now.`
            : `That's your first territory, so this is where your work in Fixer Nation lands.`,
          `If you have questions about the boundary or what comes next, just reply to this email.`,
        ];

  const text = `Good news, ${first}.

${paragraphs.join("\n\n")}

View your territory: ${url}

---
Fixer Nation · ${BASE_URL}
`;

  return {
    subject: `Approved: ${label} is your territory`,
    html: shell("Territory Request", `Good news, ${first}.`, paragraphs, "View your territory", url),
    text,
  };
}

export function buildTerritoryRequestRejectedEmail(
  name: string | null | undefined,
  state: string,
  county: string,
  adminNotes: string | null | undefined
): { subject: string; html: string; text: string } {
  const first = firstNameOf(name);
  const label = territoryLabel(state, county);
  const url = `${BASE_URL}/account`;

  const notes = adminNotes?.trim();
  const paragraphs = [
    `We looked at your request for ${label} and we can't approve it right now.`,
    ...(notes ? [`Here's what the team said: ${notes}`] : []),
    `Any territory you already hold is untouched, and nothing changed on your account.`,
    `If you want to talk it through or put in a different request, reply to this email and we'll pick it up from there.`,
  ];

  const text = `Hi ${first},

${paragraphs.join("\n\n")}

Go to your account: ${url}

---
Fixer Nation · ${BASE_URL}
`;

  return {
    subject: `Your territory request for ${label}`,
    html: shell("Territory Request", `Hi ${first},`, paragraphs, "Go to my account", url),
    text,
  };
}
