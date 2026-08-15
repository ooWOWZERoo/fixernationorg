import { Prisma, ApplicationStatus, ApplicationType, AffiliateStatus } from "@prisma/client";

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

export interface ExtraFilters {
  submittedFrom?: string;
  submittedTo?: string;
  referralCode?: string;
  campaignSource?: string;
  territory?: string;
  affiliateStatus?: string;
}

export function buildApplicationWhere(
  tab: string,
  type: string,
  q: string,
  extra: ExtraFilters = {}
): Prisma.UserApplicationWhereInput {
  const where: Prisma.UserApplicationWhereInput = {};
  const and: Prisma.UserApplicationWhereInput[] = [];

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

  // Submission date range
  if (extra.submittedFrom || extra.submittedTo) {
    const submittedAt: Prisma.DateTimeNullableFilter = {};
    if (extra.submittedFrom) submittedAt.gte = new Date(extra.submittedFrom);
    if (extra.submittedTo) {
      const end = new Date(extra.submittedTo);
      end.setHours(23, 59, 59, 999);
      submittedAt.lte = end;
    }
    and.push({ submittedAt });
  }

  // Referral code
  if (extra.referralCode?.trim()) {
    and.push({ referralCode: { contains: extra.referralCode.trim(), mode: "insensitive" } });
  }

  // Campaign source
  if (extra.campaignSource?.trim()) {
    and.push({ campaignSource: { contains: extra.campaignSource.trim(), mode: "insensitive" } });
  }

  // Territory (matches any active assignment)
  if (extra.territory?.trim()) {
    and.push({
      territoryAssignments: {
        some: {
          territory: { name: { contains: extra.territory.trim(), mode: "insensitive" } },
        },
      },
    });
  }

  // Affiliate status
  if (extra.affiliateStatus && extra.affiliateStatus !== "ALL") {
    and.push({
      affiliateAssignment: {
        status: extra.affiliateStatus as AffiliateStatus,
      },
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}
