import { makeUnsubUrl } from "@/lib/unsub-token";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export function buildCampaignEmail(
  campaign: { subject: string; htmlBody: string; textBody: string | null },
  contactId: string,
  firstName: string | null | undefined,
  sendId?: string
): { subject: string; html: string; text: string } {
  const vars = { first_name: firstName ?? "" };
  const subject = substituteVars(campaign.subject, vars);
  const bodyHtml = substituteVars(campaign.htmlBody, vars);
  const bodyText = substituteVars(campaign.textBody ?? campaign.subject, vars);

  const unsubUrl = makeUnsubUrl(contactId, BASE_URL);

  // Open tracking pixel — only injected when we have a sendId
  const trackingPixel = sendId
    ? `<img src="${BASE_URL}/api/track/open/${sendId}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />`
    : "";

  const footerHtml = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
  <tr><td style="padding:16px 0;border-top:1px solid #e5e7eb;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;color:#9ca3af;line-height:1.6;">
    You're receiving this because you're subscribed to Fixer Nation emails.<br>
    <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
  </td></tr>
</table>
${trackingPixel}`;

  const footerText = `\n\n--\nYou're receiving this because you're subscribed to Fixer Nation emails.\nUnsubscribe: ${unsubUrl}`;

  return {
    subject,
    html: bodyHtml + footerHtml,
    text: bodyText + footerText,
  };
}
