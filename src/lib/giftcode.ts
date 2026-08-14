import { db } from "@/lib/db";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function segment(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export function generateGiftCodeString(): string {
  return `FN-${segment(4)}-${segment(4)}`;
}

export async function generateUniqueGiftCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateGiftCodeString();
    const existing = await db.giftCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `FN-${segment(4)}-${segment(4)}-${segment(4)}`;
}
