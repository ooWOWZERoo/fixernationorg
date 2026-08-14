import type { NextApiRequest, NextApiResponse } from "next";
import { createHmac } from "crypto";
import { db } from "@/lib/db";

function makeToken(contactId: string): string {
  const secret = process.env.AUTH_SECRET ?? "fallback";
  return createHmac("sha256", secret).update(`unsub:${contactId}`).digest("hex");
}

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

  const expected = makeToken(contactId);
  if (token !== expected) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const now = new Date();
  await db.contactConsent.upsert({
    where: { contactId_topic: { contactId, topic: topic as "MORNING_BOOST" | "CAMPAIGNS" | "NEWSLETTERS" | "PRODUCT_UPDATES" } },
    create: { contactId, topic: topic as "MORNING_BOOST" | "CAMPAIGNS" | "NEWSLETTERS" | "PRODUCT_UPDATES", optedIn: false, optedOutAt: now, source: "unsubscribe-link" },
    update: { optedIn: false, optedOutAt: now, source: "unsubscribe-link" },
  });

  // GET: redirect to a confirmation page; POST: return JSON
  if (req.method === "GET") {
    return res.redirect("/unsubscribed");
  }
  return res.status(200).json({ ok: true });
}

// Export token generator so campaign send routes can include the link
export { makeToken as makeUnsubToken };
