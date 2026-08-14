import { db } from "@/lib/db";

const CHARS = "abcdefghijkmnpqrstuvwxyz23456789";

function generate(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generate();
    const existing = await db.ambassadorProfile.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  return generate(12);
}
