import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body;
  const expected = process.env.DESIGN_PREVIEW_PASSWORD;

  if (!expected || password !== expected) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `fn_design_preview=${expected}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 8}${secure}`
  );
  return res.status(200).json({ ok: true });
}
