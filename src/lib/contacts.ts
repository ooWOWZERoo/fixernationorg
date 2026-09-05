import { db } from "@/lib/db";
import type { ContactConsent, ContactConsentTopic } from "@prisma/client";

const MORNING_BOOST_LIST_NAME = "Morning Boost";

// Keeps the "Morning Boost" ContactList (the one admins manage by hand at
// /admin/lists) mirroring MORNING_BOOST consent -- opted in adds a contact,
// opted out removes them. Re-derives from the actual current consent rows
// rather than trusting the caller's intent, so it's correct to call after
// any write path (single upsert or a bulk import) regardless of whether
// that specific row was just created, updated, or already existed.
export async function syncMorningBoostList(contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;

  const list = await db.contactList.findFirst({
    where: { name: MORNING_BOOST_LIST_NAME, ownerType: "FN_ADMIN" },
    select: { id: true },
  });
  if (!list) return; // list doesn't exist (e.g. deleted) -- nothing to sync

  const consents = await db.contactConsent.findMany({
    where: { contactId: { in: contactIds }, topic: "MORNING_BOOST" },
    select: { contactId: true, optedIn: true },
  });

  const toAdd = consents.filter((c) => c.optedIn).map((c) => c.contactId);
  const toRemove = consents.filter((c) => !c.optedIn).map((c) => c.contactId);

  if (toAdd.length > 0) {
    await db.contactListMember.createMany({
      data: toAdd.map((contactId) => ({ listId: list.id, contactId })),
      skipDuplicates: true,
    });
  }
  if (toRemove.length > 0) {
    await db.contactListMember.deleteMany({ where: { listId: list.id, contactId: { in: toRemove } } });
  }
}

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
): Promise<ContactConsent> {
  const now = new Date();
  const consent = await db.contactConsent.upsert({
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

  if (topic === "MORNING_BOOST") {
    await syncMorningBoostList([contactId]);
  }

  return consent;
}
