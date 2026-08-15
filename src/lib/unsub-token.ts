import { createHmac } from "crypto";

const secret = () => process.env.AUTH_SECRET ?? "fallback-unsub-secret";

export function makeUnsubToken(contactId: string): string {
  return createHmac("sha256", secret()).update(`unsub:${contactId}`).digest("hex");
}

export function verifyUnsubToken(contactId: string, token: string): boolean {
  return makeUnsubToken(contactId) === token;
}

export function makeUnsubUrl(contactId: string, baseUrl: string, topic = "CAMPAIGNS"): string {
  const token = makeUnsubToken(contactId);
  return `${baseUrl}/api/public/unsubscribe?c=${encodeURIComponent(contactId)}&t=${encodeURIComponent(token)}&topic=${encodeURIComponent(topic)}`;
}
