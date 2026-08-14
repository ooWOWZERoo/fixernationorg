// Roles that have active membership access to gated content.
// CONSUMER = registered but not yet a paying member.
export const MEMBER_ROLES = [
  "MEMBER",
  "PROVIDER",
  "AMBASSADOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export function isMember(role: string): boolean {
  return MEMBER_ROLES.includes(role as MemberRole);
}
