import { db } from "./db";

const AUTO_JOIN_FLAG: Partial<Record<string, "autoMember" | "autoProvider" | "autoAmbassador">> = {
  MEMBER: "autoMember",
  PROVIDER: "autoProvider",
  AMBASSADOR: "autoAmbassador",
};

export async function autoJoinGroups(userId: string, role: string): Promise<void> {
  const flag = AUTO_JOIN_FLAG[role];
  if (!flag) return;

  const groups = await db.socialGroup.findMany({
    where: { [flag]: true },
    select: { id: true },
  });
  if (groups.length === 0) return;

  await Promise.all(
    groups.map((group) =>
      db.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: { groupId: group.id, userId, role: "MEMBER" },
        update: {},
      })
    )
  );
}
