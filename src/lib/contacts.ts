import { db } from "@/lib/db";
import type { ContactConsentTopic } from "@prisma/client";

// Shared find-or-create so every enrollment path (registration verification,
// provider/ambassador invite claim, self-service settings) links to the same
// Contact instead of duplicating this lookup with slightly different logic.
export async function ensureContactForUser(
  userId: string,
  email: string,
  name?: string | null,
  source = "signup"
): Promise<string> {
  const existingByUser = await db.contact.findUnique({ where: { userId }, select: { id: true } });
  if (existingByUser) return existingByUser.id;

  const existingByEmail = await db.contact.findUnique({ where: { email }, select: { id: true, userId: true } });
  if (existingByEmail) {
    if (!existingByEmail.userId) {
      await db.contact.update({ where: { id: existingByEmail.id }, data: { userId } });
    }
    return existingByEmail.id;
  }

  const nameParts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const contact = await db.contact.create({
    data: {
      email,
      firstName: nameParts[0] || null,
      lastName: nameParts.slice(1).join(" ") || null,
      userId,
      source,
    },
  });
  return contact.id;
}

export async function setConsent(
  contactId: string,
  topic: ContactConsentTopic,
  optedIn: boolean,
  source: string
): Promise<void> {
  const now = new Date();
  await db.contactConsent.upsert({
    where: { contactId_topic: { contactId, topic } },
    create: {
      contactId,
      topic,
      optedIn,
      optedInAt: optedIn ? now : null,
      optedOutAt: optedIn ? null : now,
      source,
    },
    update: {
      optedIn,
      optedInAt: optedIn ? now : undefined,
      optedOutAt: optedIn ? null : now,
      source,
    },
  });
}
