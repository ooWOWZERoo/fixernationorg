export type ApplicationTypeKey = "PROVIDER" | "AMBASSADOR" | "AFFILIATE";

// Lowercase role wording used in applicant-facing email and status copy.
const ROLE_LABEL: Record<ApplicationTypeKey, string> = {
  PROVIDER: "service provider",
  AMBASSADOR: "brand ambassador",
  AFFILIATE: "affiliate",
};

const APPLY_PATH: Record<ApplicationTypeKey, string> = {
  PROVIDER: "/become-a-provider",
  AMBASSADOR: "/become-an-ambassador",
  AFFILIATE: "/become-an-affiliate",
};

export function applicationRoleLabel(type: string): string {
  return ROLE_LABEL[type as ApplicationTypeKey] ?? "member";
}

export function applicationApplyPath(type: string): string {
  return APPLY_PATH[type as ApplicationTypeKey] ?? "/join";
}
