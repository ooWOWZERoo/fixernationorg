type Email = { subject: string; html: string; text: string };

export function buildAccountInviteEmail(
  name: string | null | undefined,
  type: "PROVIDER" | "AMBASSADOR",
  inviteUrl: string
): Email {
  const firstName = (name ?? "").split(" ")[0] || "there";
  const role = type === "PROVIDER" ? "service provider" : "brand ambassador";

  const subject = "Set up your Fixer Nation account";

  const text = [
    `Hi ${firstName},`,
    "",
    `Your ${role} application has been accepted. Before we can move forward with onboarding, you'll need to create your Fixer Nation account.`,
    "",
    "Click the link below to set your password and activate your account. This link expires in 30 days.",
    "",
    inviteUrl,
    "",
    `If you didn't apply to the Fixer Nation ${role} program, you can ignore this email.`,
    "",
    "Fixer Nation Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1e293b">
  <div style="background:#0f2551;padding:20px 24px;border-radius:12px 12px 0 0;margin-bottom:0">
    <p style="color:#fff;font-size:18px;font-weight:800;margin:0">Fixer Nation</p>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
    <h2 style="color:#0f2551;margin-top:0">Create your account</h2>
    <p>Hi ${firstName},</p>
    <p>Your ${role} application has been accepted. Before we can move forward with onboarding, you'll need to create your Fixer Nation account.</p>
    <p>Click the button below to set your password and activate your account. This link expires in 30 days.</p>
    <p style="margin:28px 0">
      <a href="${inviteUrl}" style="background:#0f2551;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
        Create my account
      </a>
    </p>
    <p style="color:#94a3b8;font-size:13px;word-break:break-all">Or copy this link: ${inviteUrl}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:13px">If you didn't apply to the Fixer Nation ${role} program, you can ignore this email.</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
