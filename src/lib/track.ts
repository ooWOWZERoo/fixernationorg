import crypto from "crypto";

export function trackingHmac(sendId: string): string {
  return crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(sendId)
    .digest("hex")
    .slice(0, 16);
}
