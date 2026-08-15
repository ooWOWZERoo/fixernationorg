type WelcomeEmail = { subject: string; html: string; text: string };

function display(name: string | null | undefined): string {
  return name?.trim() || "there";
}

// Generic welcome — sent when a new member verifies their email
export function buildWelcomeEmail(name: string | null | undefined): WelcomeEmail {
  const n = display(name);
  return {
    subject: "Welcome to Fixer Nation",
    html: `
      <p>Hi ${n},</p>
      <p>Your email is verified and your Fixer Nation account is ready.</p>
      <p>Log in any time at fixernation.org.</p>
      <p>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      "Your email is verified and your Fixer Nation account is ready.",
      "",
      "Log in any time at fixernation.org.",
      "",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}

export function buildWelcomeProviderEmail(name: string | null | undefined): WelcomeEmail {
  const n = display(name);
  return {
    subject: "You're in — welcome to the Fixer Nation provider network",
    html: `
      <p>Hi ${n},</p>
      <p>Your Fixer Nation service provider account is now active. You're part of a network built to connect skilled professionals with homeowners who need real help.</p>
      <p>Here's where to start:</p>
      <ul>
        <li>Log in and complete your provider profile</li>
        <li>Review your territory and service settings</li>
        <li>Check your dashboard for any next steps from our team</li>
      </ul>
      <p>If you have questions or run into anything, reply to this email — a real person reads it.</p>
      <p>Welcome aboard.<br/>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      "Your Fixer Nation service provider account is now active. You're part of a network built to connect skilled professionals with homeowners who need real help.",
      "",
      "Here's where to start:",
      "- Log in and complete your provider profile",
      "- Review your territory and service settings",
      "- Check your dashboard for any next steps from our team",
      "",
      "If you have questions or run into anything, reply to this email — a real person reads it.",
      "",
      "Welcome aboard.",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}

export function buildWelcomeAmbassadorEmail(name: string | null | undefined): WelcomeEmail {
  const n = display(name);
  return {
    subject: "You're officially a Fixer Nation Ambassador",
    html: `
      <p>Hi ${n},</p>
      <p>Your ambassador account is active. We're glad you're here.</p>
      <p>As a Fixer Nation Ambassador, you'll help connect people in your community with trusted home service professionals — and earn commissions when they do.</p>
      <p>A few things to take care of first:</p>
      <ul>
        <li>Log in and check your ambassador dashboard</li>
        <li>Make sure your promo code is set up (if you don't see one, reach out)</li>
        <li>Complete tax and payout onboarding so you can get paid</li>
        <li>Review your territory assignment</li>
      </ul>
      <p>Our team will be in touch with more details. In the meantime, reply here with any questions.</p>
      <p>Thanks for joining us.<br/>The Fixer Nation Team</p>
    `.trim(),
    text: [
      `Hi ${n},`,
      "",
      "Your ambassador account is active. We're glad you're here.",
      "",
      "As a Fixer Nation Ambassador, you'll help connect people in your community with trusted home service professionals — and earn commissions when they do.",
      "",
      "A few things to take care of first:",
      "- Log in and check your ambassador dashboard",
      "- Make sure your promo code is set up (if you don't see one, reach out)",
      "- Complete tax and payout onboarding so you can get paid",
      "- Review your territory assignment",
      "",
      "Our team will be in touch with more details. In the meantime, reply here with any questions.",
      "",
      "Thanks for joining us.",
      "The Fixer Nation Team",
    ].join("\n"),
  };
}
