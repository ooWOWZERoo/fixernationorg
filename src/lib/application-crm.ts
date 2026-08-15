import { db } from "@/lib/db";

// Tags applied per application type and status
const TYPE_TAG: Record<string, string> = {
  PROVIDER: "PROVIDER_APPLICANT",
  AMBASSADOR: "AMBASSADOR_APPLICANT",
};

const ACCEPTED_TAG: Record<string, string> = {
  PROVIDER: "PROVIDER_ACCEPTED",
  AMBASSADOR: "AMBASSADOR_ACCEPTED",
};

const ACTIVE_TAG: Record<string, string> = {
  PROVIDER: "ACTIVE_PROVIDER",
  AMBASSADOR: "ACTIVE_AMBASSADOR",
};

// Tags removed when an application reaches a terminal or transitional state
const ONBOARDING_TAGS = new Set([
  "ONBOARDING_IN_PROGRESS",
  "TERRITORY_PENDING",
  "AFFILIATE_PENDING",
  "PAYMENT_PENDING",
]);

type ApplicationLike = {
  id: string;
  email: string;
  name: string | null;
  type: string;
  status: string;
  userId: string | null;
};

async function addTag(contactId: string, tag: string) {
  await db.contactTag.upsert({
    where: { contactId_tag: { contactId, tag } },
    create: { contactId, tag },
    update: {},
  });
}

async function removeTag(contactId: string, tag: string) {
  await db.contactTag
    .delete({ where: { contactId_tag: { contactId, tag } } })
    .catch(() => {});
}

async function removeTagsMatching(contactId: string, tags: string[]) {
  await Promise.all(tags.map((t) => removeTag(contactId, t)));
}

// Find or create a Contact for this application, returns contact id.
// Also sets application.contactId if it isn't set yet.
export async function syncApplicationContact(application: ApplicationLike): Promise<string> {
  // Find or create Contact
  const firstName = application.name?.split(" ")[0] ?? null;
  const lastName = application.name?.includes(" ")
    ? application.name.split(" ").slice(1).join(" ")
    : null;

  const contact = await db.contact.upsert({
    where: { email: application.email },
    create: {
      email: application.email,
      firstName,
      lastName,
      source: "application",
      ...(application.userId ? { userId: application.userId } : {}),
    },
    update: {
      // Fill in name only if not already set
      ...(firstName ? { firstName: { set: undefined } } : {}),
      // Link userId if application now has one
      ...(application.userId ? { userId: application.userId } : {}),
    },
  });

  // Back-fill name if contact has none
  if (!contact.firstName && firstName) {
    await db.contact.update({
      where: { id: contact.id },
      data: { firstName, lastName: lastName ?? undefined },
    });
  }

  // Set contactId on application if not already set
  const app = await db.userApplication.findUnique({
    where: { id: application.id },
    select: { contactId: true },
  });
  if (!app?.contactId) {
    await db.userApplication.update({
      where: { id: application.id },
      data: { contactId: contact.id },
    });
  }

  return contact.id;
}

// Apply CRM tags based on current application status.
// Idempotent — safe to call multiple times.
export async function applyApplicationTags(application: ApplicationLike): Promise<void> {
  const contactId = await syncApplicationContact(application);
  const { type, status } = application;

  const applicantTag = TYPE_TAG[type];
  const acceptedTag = ACCEPTED_TAG[type];
  const activeTag = ACTIVE_TAG[type];

  if (["SUBMITTED", "PENDING", "RESUBMITTED", "UNDER_REVIEW",
       "ADDITIONAL_INFO_REQUIRED", "CONDITIONALLY_ACCEPTED"].includes(status)) {
    if (applicantTag) await addTag(contactId, applicantTag);
  }

  if (["ACCEPTED_ONBOARDING_REQUIRED", "CONDITIONALLY_ACCEPTED",
       "ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING", "TERRITORY_PENDING"].includes(status)) {
    if (acceptedTag) await addTag(contactId, acceptedTag);
    await addTag(contactId, "ONBOARDING_IN_PROGRESS");
  }

  if (["ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING"].includes(status)) {
    await addTag(contactId, "PAYMENT_PENDING");
  }

  if (status === "ACTIVE") {
    if (activeTag) await addTag(contactId, activeTag);
    if (acceptedTag) await removeTag(contactId, acceptedTag);
    if (applicantTag) await removeTag(contactId, applicantTag);
    await removeTagsMatching(contactId, ["ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING",
      "TERRITORY_PENDING", "AFFILIATE_PENDING", "DECLINED_APPLICANT"]);
  }

  if (["DECLINED", "REJECTED"].includes(status)) {
    await addTag(contactId, "DECLINED_APPLICANT");
    if (applicantTag) await removeTag(contactId, applicantTag);
    await removeTagsMatching(contactId, Array.from(ONBOARDING_TAGS));
  }

  if (["WITHDRAWN", "EXPIRED"].includes(status)) {
    if (applicantTag) await removeTag(contactId, applicantTag);
    await removeTagsMatching(contactId, Array.from(ONBOARDING_TAGS));
  }
}
