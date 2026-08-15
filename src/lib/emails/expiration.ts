type Email = { subject: string; html: string; text: string };

function display(name: string | null | undefined): string {
  return name?.trim() || "there";
}

export function buildApplicationExpiredEmail(
  name: string | null | undefined,
  type: "PROVIDER" | "AMBASSADOR"
): Email {
  const n = display(name);
  const role = type === "PROVIDER" ? "service provider" : "brand ambassador";
  return {
    subject: "Your Fixer Nation application has expired",
    html: `
      <p>Hi ${n},</p>
      <p>Your ${role} application with Fixer Nation has expired due to inactivity. We hadn't heard from you in a while, so we've closed the application automatically.</p>
      <p>If you're still interested, you're welcome to reapply. Your previous information won't be lost, and our team will review your new application.</p>
      <p>If you have questions or think this is a mistake, reply to this email and we'll sort it out.</p>
      <p>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      `Your ${role} application with Fixer Nation has expired due to inactivity. We hadn't heard from you in a while, so we've closed the application automatically.`,
      "",
      "If you're still interested, you're welcome to reapply. Your previous information won't be lost, and our team will review your new application.",
      "",
      "If you have questions or think this is a mistake, reply to this email and we'll sort it out.",
      "",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}

export function buildApplicationWithdrawnEmail(
  name: string | null | undefined,
  type: "PROVIDER" | "AMBASSADOR"
): Email {
  const n = display(name);
  const role = type === "PROVIDER" ? "service provider" : "brand ambassador";
  return {
    subject: "Your Fixer Nation application has been withdrawn",
    html: `
      <p>Hi ${n},</p>
      <p>We've received your withdrawal request for your Fixer Nation ${role} application. Your application has been closed and all pending reminders have been stopped.</p>
      <p>You're welcome to reapply in the future. If you withdrew by mistake or have questions, reply to this email.</p>
      <p>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      `We've received your withdrawal request for your Fixer Nation ${role} application. Your application has been closed and all pending reminders have been stopped.`,
      "",
      "You're welcome to reapply in the future. If you withdrew by mistake or have questions, reply to this email.",
      "",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}
