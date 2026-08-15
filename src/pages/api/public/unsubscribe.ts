import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { verifyUnsubToken } from "@/lib/unsub-token";

export { makeUnsubToken } from "@/lib/unsub-token";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contactId = req.query.c as string;
  const token = req.query.t as string;
  const topic = (req.query.topic as string) ?? "CAMPAIGNS";

  if (!contactId || !token) {
    return res.status(400).json({ error: "Invalid unsubscribe link" });
  }

  if (!verifyUnsubToken(contactId, token)) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const now = new Date();

  await db.contactConsent.upsert({
    where: {
      contactId_topic: {
        contactId,
        topic: topic as "MORNING_BOOST" | "CAMPAIGNS" | "NEWSLETTERS" | "PRODUCT_UPDATES",
      },
    },
    create: {
      contactId,
      topic: topic as "MORNING_BOOST" | "CAMPAIGNS" | "NEWSLETTERS" | "PRODUCT_UPDATES",
      optedIn: false,
      optedOutAt: now,
      source: "unsubscribe-link",
    },
    update: { optedIn: false, optedOutAt: now, source: "unsubscribe-link" },
  });

  // Cancel any queued sends for this contact so they don't go out after unsubscribing
  await db.campaignSend.updateMany({
    where: { contactId, status: "QUEUED" },
    data: { status: "UNSUBSCRIBED", unsubAt: now },
  });

  if (req.method === "GET") {
    return res.redirect("/unsubscribed");
  }
  return res.status(200).json({ ok: true });
}
