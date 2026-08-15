type Email = { subject: string; html: string; text: string };

function display(name: string | null | undefined): string {
  return name?.trim() || "there";
}

export function buildExpirationReminderEmail(
  name: string | null | undefined,
  type: "PROVIDER" | "AMBASSADOR",
  daysLeft: number
): Email {
  const n = display(name);
  const role = type === "PROVIDER" ? "service provider" : "brand ambassador";
  const deadline = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const applyPath = type === "PROVIDER" ? "/become-a-provider" : "/become-an-ambassador";

  return {
    subject: `Your Fixer Nation application expires ${deadline}`,
    html: `
      <p>Hi ${n},</p>
      <p>Just a heads-up — your ${role} application with Fixer Nation expires ${deadline}.</p>
      <p>We accepted your application and started the onboarding process, but we still need a few things from you to complete it. If we don't hear back before the deadline, the application will close automatically.</p>
      <p>To pick up where you left off, <a href="https://fixernation.org${applyPath}">sign in and check your application status</a>, or reply to this email and we'll help you get back on track.</p>
      <p>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      `Just a heads-up — your ${role} application with Fixer Nation expires ${deadline}.`,
      "",
      "We accepted your application and started the onboarding process, but we still need a few things from you to complete it. If we don't hear back before the deadline, the application will close automatically.",
      "",
      `To pick up where you left off, visit https://fixernation.org${applyPath} and sign in, or reply to this email and we'll help you get back on track.`,
      "",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}
