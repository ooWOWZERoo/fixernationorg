import { Prisma, ApplicationStatus, ApplicationType } from "@prisma/client";

export const PAGE_SIZE = 50;

// Maps each tab key to the ApplicationStatus values it covers.
// Shared by the list page (GSSP) and the export endpoint.
export const TAB_STATUS_MAP: Record<string, ApplicationStatus[]> = {
  QUEUE: [ApplicationStatus.SUBMITTED, ApplicationStatus.RESUBMITTED, ApplicationStatus.PENDING],
  ACTIVE: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.ADDITIONAL_INFO_REQUIRED,
    ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ],
  ACCEPTED: [
    ApplicationStatus.ACCEPTED_ONBOARDING_REQUIRED,
    ApplicationStatus.ONBOARDING_IN_PROGRESS,
    ApplicationStatus.TERRITORY_PENDING,
    ApplicationStatus.PAYMENT_PENDING,
    ApplicationStatus.PAYMENT_FAILED,
    ApplicationStatus.ACTIVE,
    ApplicationStatus.APPROVED,
  ],
  CLOSED: [
    ApplicationStatus.DECLINED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.EXPIRED,
  ],
};

export function buildApplicationWhere(
  tab: string,
  type: string,
  q: string
): Prisma.UserApplicationWhereInput {
  const where: Prisma.UserApplicationWhereInput = {};

  const tabStatuses = TAB_STATUS_MAP[tab];
  if (tabStatuses) {
    where.status = { in: tabStatuses };
  }

  if (type === "PROVIDER") where.type = ApplicationType.PROVIDER;
  else if (type === "AMBASSADOR") where.type = ApplicationType.AMBASSADOR;

  const search = q.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
      { providerDetail: { serviceCategory: { contains: search, mode: "insensitive" } } },
      { ambassadorDetail: { city: { contains: search, mode: "insensitive" } } },
      { ambassadorDetail: { state: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}
