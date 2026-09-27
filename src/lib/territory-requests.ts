import type { Prisma } from "@prisma/client";
import { bareCountyName } from "@/lib/us-geo";

export type TerritoryRequestType = "INITIAL" | "ADD" | "CHANGE";
export type TerritoryRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export const TERRITORY_REQUEST_TYPE_LABEL: Record<TerritoryRequestType, string> = {
  INITIAL: "First territory",
  ADD: "Additional territory",
  CHANGE: "Territory change",
};

export const TERRITORY_REQUEST_STATUS_LABEL: Record<TerritoryRequestStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Roles that can hold a territory — same set as TERRITORY_ELIGIBLE_TYPES on the admin side. */
export const TERRITORY_ELIGIBLE_ROLES: string[] = ["AMBASSADOR", "PROVIDER", "AFFILIATE"];

export interface TerritoryRequestRow {
  id: string;
  userId: string;
  applicationId: string | null;
  requestType: TerritoryRequestType;
  requestedState: string;
  requestedCounty: string;
  existingAssignmentId: string | null;
  status: TerritoryRequestStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The local Prisma client has no TerritoryRequest delegate until `prisma
 * generate` runs on Vercel, so every call site reaches the model through this
 * cast. Declared once here rather than re-typed in each route so the shape
 * can't drift between the submit endpoint, the review endpoint and the admin
 * page's getServerSideProps.
 */
export interface TerritoryRequestDelegate {
  territoryRequest: {
    findMany: (args?: {
      where?: object;
      orderBy?: object;
      include?: object;
      take?: number;
    }) => Promise<TerritoryRequestRow[]>;
    findFirst: (args: { where: object; include?: object }) => Promise<TerritoryRequestRow | null>;
    findUnique: (args: { where: object; include?: object }) => Promise<TerritoryRequestRow | null>;
    create: (args: { data: object }) => Promise<TerritoryRequestRow>;
    update: (args: { where: object; data: object }) => Promise<TerritoryRequestRow>;
    updateMany: (args: { where: object; data: object }) => Promise<{ count: number }>;
    count: (args?: { where?: object }) => Promise<number>;
  };
}

export function withTerritoryRequests<T>(client: T): T & TerritoryRequestDelegate {
  return client as never as T & TerritoryRequestDelegate;
}

export interface MatchedTerritory {
  id: string;
  name: string;
  status: string;
  isExclusive: boolean;
}

/**
 * Read-only lookup of the County-scope Territory a state + county pair maps
 * to, or null if none exists yet.
 *
 * The lookup also tries the county name without its suffix, because County
 * was a free-text field before SP-74 and existing rows may read "Fulton"
 * where the reference dataset says "Fulton County". Without that, approving a
 * request would quietly create a second Territory for a county an admin had
 * already set up — and split its assignment history across two rows.
 */
export async function findCountyTerritory(
  client: Pick<Prisma.TransactionClient, "territory">,
  state: string,
  county: string
): Promise<MatchedTerritory | null> {
  const bare = bareCountyName(county);

  const existing = await client.territory.findFirst({
    where: {
      scope: "COUNTY",
      state,
      OR: [
        { county: { equals: county, mode: "insensitive" } },
        { county: { equals: bare, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (!existing) return null;
  return {
    id: existing.id,
    name: existing.name,
    status: existing.status,
    isExclusive: existing.isExclusive,
  };
}

/**
 * Finds the County-scope Territory for a state + county pair, creating it if
 * it doesn't exist yet. Non-exclusive on creation, which is this platform's
 * stated default — exclusivity stays a per-territory decision an admin makes
 * deliberately, never something an approval turns on implicitly.
 */
export async function resolveOrCreateCountyTerritory(
  tx: Prisma.TransactionClient,
  state: string,
  county: string
): Promise<MatchedTerritory & { created: boolean }> {
  const existing = await findCountyTerritory(tx, state, county);
  if (existing) return { ...existing, created: false };

  const created = await tx.territory.create({
    data: {
      name: `${county}, ${state}`,
      type: "GEOGRAPHIC",
      scope: "COUNTY",
      state,
      county,
      status: "ACTIVE",
      isExclusive: false,
      description: "Created on approval of a territory request.",
    },
  });

  return {
    id: created.id,
    name: created.name,
    status: created.status,
    isExclusive: created.isExclusive,
    created: true,
  };
}
