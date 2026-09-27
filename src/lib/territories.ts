import type { Prisma } from "@prisma/client";

/**
 * Thrown by assertTerritoryAssignable when a territory can't take a new
 * active assignment. Carries the exact message the API surfaces as a 409 —
 * the wording is asserted verbatim by tests/e2e/admin-territories.spec.ts.
 *
 * A named error class rather than a boolean return so the check can run
 * inside db.$transaction and still unwind out of it without the
 * transaction's return type having to absorb a failure case.
 */
export class TerritoryNotAssignableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerritoryNotAssignableError";
  }
}

/** Only the fields the assignability rules actually read. */
export type AssignableTerritory = {
  id: string;
  status: string;
  isExclusive: boolean;
};

/**
 * The two gates every new ACTIVE TerritoryAssignment has to clear, wherever
 * it's created from: the admin's direct assign on /admin/territories, and
 * the SP-74 territory-request approval.
 *
 * Both checks used to live inline in api/admin/territories/[id].ts. They're
 * shared now specifically so the approval path can't pick up one gate and
 * silently skip the other.
 *
 * Call this INSIDE a db.$transaction and pass that transaction's client: the
 * exclusivity rule is a count-then-create sequence, so running the count on
 * the same transaction as the create is what stops two concurrent requests
 * from both passing the count before either write lands.
 */
export async function assertTerritoryAssignable(
  tx: Prisma.TransactionClient,
  territory: AssignableTerritory
): Promise<void> {
  if (territory.status === "LOCKED") {
    throw new TerritoryNotAssignableError("This territory is locked and cannot be assigned.");
  }

  // Exclusivity is per-territory, not a universal one-affiliate-per-territory
  // rule — a non-exclusive territory can carry any number of active
  // assignments by design.
  if (!territory.isExclusive) return;

  const activeCount = await tx.territoryAssignment.count({
    where: { territoryId: territory.id, status: "ACTIVE" },
  });
  if (activeCount > 0) {
    throw new TerritoryNotAssignableError(
      "This territory is exclusive and already has an active assignment."
    );
  }
}
