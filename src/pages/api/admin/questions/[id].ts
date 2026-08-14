import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { QuestionStatus } from "@prisma/client";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const putSchema = z.object({
  status: z.nativeEnum(QuestionStatus).optional(),
  reply: z.string().min(1).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const { status, reply } = parsed.data;
  if (!status && !reply) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const question = await db.fixerQuestion.findUnique({ where: { id } });
  if (!question) return res.status(404).json({ error: "Not found" });

  const isSendingReply = !!reply;

  const updated = await db.fixerQuestion.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(isSendingReply ? {
        reply,
        status: "RESPONDED",
        respondedAt: new Date(),
      } : {}),
      ...(status === "RESPONDED" && !isSendingReply ? { respondedAt: new Date() } : {}),
    },
  });

  if (isSendingReply) {
    const subjectLine = question.subject
      ? `Re: ${question.subject}`
      : "Your Ask The Fixer question";

    await sendEmail({
      to: question.email,
      subject: subjectLine,
      html: `
        <p>Hi ${question.name},</p>
        <p>Thanks for reaching out through Ask The Fixer. Here's a response to your question:</p>
        <blockquote style="border-left:3px solid #F2A93C;margin:16px 0;padding:8px 16px;color:#5C6470;">
          ${reply.replace(/\n/g, "<br>")}
        </blockquote>
        <p>If you have a follow-up question, visit <a href="${process.env.NEXTAUTH_URL ?? "https://fixernation.org"}/ask-the-fixer">Ask The Fixer</a> anytime.</p>
        <p>— The Fixer Nation Team</p>
      `,
      text: `Hi ${question.name},\n\nThanks for reaching out through Ask The Fixer. Here's a response to your question:\n\n${reply}\n\nIf you have a follow-up, visit https://fixernation.org/ask-the-fixer\n\n— The Fixer Nation Team`,
    });
  }

  return res.status(200).json(updated);
}
