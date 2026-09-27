type Email = { subject: string; html: string; text: string };

function display(name: string | null | undefined): string {
  return name?.trim() || "there";
}

function htmlParagraphs(lines: string[]): string {
  return lines.map((l) => `<p>${l}</p>`).join("\n      ");
}

export function buildMembershipThankYouEmail(
  name: string | null | undefined,
  planName: string,
  billingUrl: string
): Email {
  const n = display(name);
  return {
    subject: "You're in. Welcome to Fixer Nation.",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your ${planName} membership is active. Thanks for joining.`,
      `Here's what you get right away: Morning Boost, the full resource library, community groups, and everything else that comes with membership.`,
      `Manage your plan or update your card anytime at <a href="${billingUrl}">${billingUrl}</a>.`,
      `Glad you're here.<br>The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your ${planName} membership is active. Thanks for joining.`,
      "",
      "Here's what you get right away: Morning Boost, the full resource library, community groups, and everything else that comes with membership.",
      "",
      `Manage your plan or update your card anytime at ${billingUrl}.`,
      "",
      "Glad you're here.",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildRenewalReminder30Email(
  name: string | null | undefined,
  planName: string,
  renewalDate: string,
  amount: string,
  billingUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your membership renews in 30 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Quick heads up. Your ${planName} membership renews on ${renewalDate}. You'll be charged ${amount} automatically, same card as before.`,
      `Nothing to do if that's all good. Want to change your plan or update payment info first? Head to <a href="${billingUrl}">${billingUrl}</a>.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Quick heads up. Your ${planName} membership renews on ${renewalDate}. You'll be charged ${amount} automatically, same card as before.`,
      "",
      `Nothing to do if that's all good. Want to change your plan or update payment info first? Head to ${billingUrl}.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildRenewalReminder7Email(
  name: string | null | undefined,
  planName: string,
  renewalDate: string,
  amount: string,
  billingUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your membership renews in 7 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `One week out. Your ${planName} membership renews on ${renewalDate} for ${amount}.`,
      `If everything looks right, you don't need to do anything. Want to make a change first? Head to <a href="${billingUrl}">${billingUrl}</a>.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `One week out. Your ${planName} membership renews on ${renewalDate} for ${amount}.`,
      "",
      `If everything looks right, you don't need to do anything. Want to make a change first? Head to ${billingUrl}.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildGiftExpiring30Email(
  name: string | null | undefined,
  renewalDate: string,
  upgradeUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your free membership ends in 30 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your free 90-day membership from your book purchase ends on ${renewalDate}. After that, you'll lose access to Morning Boost, the resource library, and community groups.`,
      `Want to keep it going? Upgrade to a paid membership anytime at <a href="${upgradeUrl}">${upgradeUrl}</a>. No interruption, no starting over.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your free 90-day membership from your book purchase ends on ${renewalDate}. After that, you'll lose access to Morning Boost, the resource library, and community groups.`,
      "",
      `Want to keep it going? Upgrade to a paid membership anytime at ${upgradeUrl}. No interruption, no starting over.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildGiftExpiring7Email(
  name: string | null | undefined,
  renewalDate: string,
  upgradeUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your free membership ends in 7 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `One week left on your free membership. It ends ${renewalDate}.`,
      `Want to keep your access? Upgrade at <a href="${upgradeUrl}">${upgradeUrl}</a> before it lapses.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `One week left on your free membership. It ends ${renewalDate}.`,
      "",
      `Want to keep your access? Upgrade at ${upgradeUrl} before it lapses.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildPaymentFailedEmail(
  name: string | null | undefined,
  planName: string,
  billingUrl: string
): Email {
  const n = display(name);
  return {
    subject: "We couldn't process your membership payment",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your card was declined when we tried to renew your ${planName} membership. Your access hasn't changed yet, but we'll need an updated payment method soon to keep it that way.`,
      `Update your card at <a href="${billingUrl}">${billingUrl}</a>.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your card was declined when we tried to renew your ${planName} membership. Your access hasn't changed yet, but we'll need an updated payment method soon to keep it that way.`,
      "",
      `Update your card at ${billingUrl}.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildRenewalReceiptEmail(
  name: string | null | undefined,
  planName: string,
  amount: string,
  renewalDate: string,
  billingUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your membership renewed",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your ${planName} membership just renewed. ${amount} was charged to your card on file, and you're set through ${renewalDate}.`,
      `Full billing history and receipts are at <a href="${billingUrl}">${billingUrl}</a>.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your ${planName} membership just renewed. ${amount} was charged to your card on file, and you're set through ${renewalDate}.`,
      "",
      `Full billing history and receipts are at ${billingUrl}.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildMembershipCanceledEmail(
  name: string | null | undefined,
  planName: string,
  upgradeUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your Fixer Nation membership has been canceled",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your ${planName} membership is canceled, effective now. You'll keep the free-tier features, but member-only content and groups are no longer available.`,
      `Changed your mind? You can resubscribe anytime at <a href="${upgradeUrl}">${upgradeUrl}</a>.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your ${planName} membership is canceled, effective now. You'll keep the free-tier features, but member-only content and groups are no longer available.`,
      "",
      `Changed your mind? You can resubscribe anytime at ${upgradeUrl}.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

// SP-77 — sent when an admin hand-builds an account for someone who already
// paid on our old platform. The account has no password yet, so the whole
// point of this email is the set-password link.
export function buildManualGrantWelcomeEmail(
  name: string | null | undefined,
  planName: string,
  setPasswordUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your Fixer Nation membership is ready",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Your ${planName} membership is set up and waiting on the new Fixer Nation site. We moved it over by hand, so there's one thing left for you to do: pick a password.`,
      `<a href="${setPasswordUrl}">Set your password</a>`,
      `That link works for the next 30 days. Once you're in, you've got Morning Boost, the full resource library, community groups, and everything else membership includes.`,
      `Glad you're here.<br>The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Your ${planName} membership is set up and waiting on the new Fixer Nation site. We moved it over by hand, so there's one thing left for you to do: pick a password.`,
      "",
      `Set your password: ${setPasswordUrl}`,
      "",
      "That link works for the next 30 days. Once you're in, you've got Morning Boost, the full resource library, community groups, and everything else membership includes.",
      "",
      "Glad you're here.",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

// SP-77 — the MANUAL_GRANT equivalent of buildGiftExpiring30Email. Kept
// separate on purpose: the gift copy pitches an upgrade to paid, which is the
// wrong thing to say to someone who already paid us elsewhere.
export function buildManualGrantExpiring30Email(
  name: string | null | undefined,
  planName: string,
  renewalDate: string,
  contactUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your membership access ends in 30 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `Heads up. Your ${planName} membership is set to end on ${renewalDate}. After that, Morning Boost, the resource library, and community groups go away.`,
      `This one doesn't renew on its own, so nothing will be charged. If that end date looks wrong, or you'd rather keep going, get in touch at <a href="${contactUrl}">${contactUrl}</a> and we'll take care of it.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `Heads up. Your ${planName} membership is set to end on ${renewalDate}. After that, Morning Boost, the resource library, and community groups go away.`,
      "",
      `This one doesn't renew on its own, so nothing will be charged. If that end date looks wrong, or you'd rather keep going, get in touch at ${contactUrl} and we'll take care of it.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}

export function buildManualGrantExpiring7Email(
  name: string | null | undefined,
  planName: string,
  renewalDate: string,
  contactUrl: string
): Email {
  const n = display(name);
  return {
    subject: "Your membership access ends in 7 days",
    html: htmlParagraphs([
      `Hey ${n},`,
      `One week left. Your ${planName} membership ends on ${renewalDate}.`,
      `Nothing gets charged either way — this membership doesn't auto-renew. Want to keep your access? Reach us at <a href="${contactUrl}">${contactUrl}</a> before it lapses.`,
      `The Fixer Nation team`,
    ]),
    text: [
      `Hey ${n},`,
      "",
      `One week left. Your ${planName} membership ends on ${renewalDate}.`,
      "",
      `Nothing gets charged either way — this membership doesn't auto-renew. Want to keep your access? Reach us at ${contactUrl} before it lapses.`,
      "",
      "The Fixer Nation team",
    ].join("\n"),
  };
}
