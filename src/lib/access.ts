// Roles that have active membership access to gated content.
// CONSUMER = registered but not yet a paying/accepted member.
export const MEMBER_ROLES = ["MEMBER", "PROVIDER", "AMBASSADOR"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export type AdminRoleValue = (typeof ADMIN_ROLES)[number];

// A user has member access if their membership role grants it OR if they are admin staff.
export function isMember(role: string, adminRole?: string): boolean {
  return (
    MEMBER_ROLES.includes(role as MemberRole) ||
    ADMIN_ROLES.includes((adminRole ?? "") as AdminRoleValue)
  );
}
