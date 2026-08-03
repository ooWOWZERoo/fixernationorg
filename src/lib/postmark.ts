import * as postmark from "postmark";

let _client: postmark.ServerClient | null = null;

// Stub — `POSTMARK_SERVER_TOKEN` is required at Phase 1, not Stage 0.
export function getMailer(): postmark.ServerClient {
  if (_client) return _client;

  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    throw new Error(
      "[postmark] POSTMARK_SERVER_TOKEN is not configured. Required at Phase 1."
    );
  }

  _client = new postmark.ServerClient(token);
  return _client;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  messageStream?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const client = getMailer();
  await client.sendEmail({
    From: `${process.env.POSTMARK_FROM_NAME ?? "Fixer Nation"} <${
      process.env.POSTMARK_FROM_ADDRESS ?? "noreply@fixernation.org"
    }>`,
    To: opts.to,
    Subject: opts.subject,
    HtmlBody: opts.htmlBody,
    TextBody: opts.textBody ?? opts.subject,
    MessageStream: opts.messageStream ?? "outbound",
  });
}
